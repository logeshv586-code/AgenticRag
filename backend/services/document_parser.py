"""
Document Parser — Handles extraction from PDF, TXT, DOCX, CSV, HTML, Markdown, and Images (OCR).
"""
import os
import logging

logger = logging.getLogger(__name__)

# Optional imports — graceful degradation
try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import pytesseract
    from PIL import Image, ImageFilter, ImageEnhance
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False


def parse_document(file_path: str) -> str:
    """
    Reads an uploaded file and extracts text content.
    Supports: PDF, TXT, DOCX, CSV, HTML, MD, Images (OCR).
    """
    if not os.path.exists(file_path):
        return "File not found."

    ext = os.path.splitext(file_path)[1].lower()
    extracted_text = ""

    try:
        if ext == '.pdf':
            extracted_text = _parse_pdf(file_path)
        elif ext == '.txt':
            extracted_text = _parse_text(file_path)
        elif ext == '.docx':
            extracted_text = _parse_docx(file_path)
        elif ext == '.csv':
            extracted_text = _parse_csv(file_path)
        elif ext in ('.html', '.htm'):
            extracted_text = _parse_html(file_path)
        elif ext in ('.md', '.markdown'):
            extracted_text = _parse_markdown(file_path)
        elif ext in ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'):
            extracted_text = _parse_image(file_path)
        else:
            return f"Unsupported file type: {ext}"

        return extracted_text.strip() if extracted_text else f"No text extracted from {ext} file."

    except Exception as e:
        logger.error(f"Error parsing document ({ext}): {e}")
        return f"Error parsing document ({ext}): {str(e)}"


def _parse_pdf(file_path: str) -> str:
    """Extract text from PDF, falling back to OCR for image-based PDFs."""
    if not PDF_AVAILABLE:
        return "PDF library (pdfplumber) is not installed."

    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
            elif OCR_AVAILABLE:
                # Fallback: convert page to image and OCR
                img = page.to_image(resolution=300).original
                text_parts.append(pytesseract.image_to_string(img))

    # Also extract tables
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    clean_row = [str(cell or '') for cell in row]
                    text_parts.append(' | '.join(clean_row))

    return '\n'.join(text_parts)


def _parse_text(file_path: str) -> str:
    """Read plain text files with encoding detection."""
    encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "Could not decode text file."


def _parse_docx(file_path: str) -> str:
    """Extract text from DOCX files."""
    if not DOCX_AVAILABLE:
        return "DOCX library (python-docx) is not installed."

    doc = docx.Document(file_path)
    text_parts = []

    for para in doc.paragraphs:
        if para.text.strip():
            text_parts.append(para.text)

    # Also extract text from tables
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                text_parts.append(' | '.join(cells))

    return '\n'.join(text_parts)


def _parse_csv(file_path: str) -> str:
    """Extract text from CSV files with intelligent column handling."""
    import csv

    text_parts = []
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        headers = None
        for i, row in enumerate(reader):
            if i == 0:
                headers = row
                text_parts.append('Columns: ' + ', '.join(row))
            else:
                if headers:
                    pairs = [f"{h}: {v}" for h, v in zip(headers, row) if v.strip()]
                    text_parts.append('; '.join(pairs))
                else:
                    text_parts.append(', '.join(row))
            if i > 500:  # cap rows for very large CSVs
                text_parts.append(f"... (truncated at {i} rows)")
                break

    return '\n'.join(text_parts)


def _parse_html(file_path: str) -> str:
    """Extract text from local HTML files."""
    from bs4 import BeautifulSoup

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()

    content = soup.find('article') or soup.find('main') or soup.body or soup
    return content.get_text(separator='\n', strip=True)


def _parse_markdown(file_path: str) -> str:
    """Extract text from Markdown files (strip formatting)."""
    import re

    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Strip common markdown syntax while preserving content
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)  # headers
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)  # italic
    text = re.sub(r'`(.+?)`', r'\1', text)  # inline code
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)  # images
    text = re.sub(r'\[(.+?)\]\(.*?\)', r'\1', text)  # links

    return text


def _parse_image(file_path: str) -> str:
    """Extract text from images using OCR with preprocessing."""
    if not OCR_AVAILABLE:
        return "OCR libraries (pytesseract/Pillow) are not installed."

    image = Image.open(file_path)

    # Preprocessing for better OCR accuracy
    image = image.convert('L')  # grayscale
    image = ImageEnhance.Contrast(image).enhance(2.0)  # boost contrast
    image = image.filter(ImageFilter.SHARPEN)  # sharpen

    # Configure Tesseract path for Windows if needed
    if os.name == 'nt':
        tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        if os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path

    text = pytesseract.image_to_string(image, config='--oem 3 --psm 6')
    return text


def get_supported_extensions() -> list:
    """Return list of supported file extensions."""
    exts = ['.pdf', '.txt', '.csv', '.html', '.htm', '.md', '.markdown']
    if DOCX_AVAILABLE:
        exts.append('.docx')
    if OCR_AVAILABLE:
        exts.extend(['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'])
    return exts
