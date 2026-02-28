import pdfplumber
import os
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

def parse_document(file_path: str) -> str:
    """
    Reads an uploaded file (PDF, TXT, Images)
    and extracts text content using OCR if needed.
    """
    if not os.path.exists(file_path):
        return "File not found."
    
    ext = os.path.splitext(file_path)[1].lower()
    extracted_text = ""
    
    try:
        if ext == '.pdf':
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
        elif ext == '.txt':
            with open(file_path, "r", encoding="utf-8") as f:
                extracted_text = f.read()
        elif ext in ['.jpg', '.jpeg', '.png']:
            if not OCR_AVAILABLE:
                return "OCR libraries (pytesseract/Pillow) are not installed on the server."
            
            # Simple OCR
            image = Image.open(file_path)
            # You might need to specify the tesseract path on Windows
            # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            extracted_text = pytesseract.image_to_string(image)
        else:
            return f"Unsupported file type: {ext}"
            
        return extracted_text.strip()
    except Exception as e:
        return f"Error parsing document ({ext}): {str(e)}"
