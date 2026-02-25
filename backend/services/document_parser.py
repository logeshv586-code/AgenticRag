import pdfplumber
import os

def parse_document(file_path: str) -> str:
    """
    Reads an uploaded file (currently supporting PDF)
    and extracts text content.
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
        else:
            return f"Unsupported file type: {ext}"
            
        return extracted_text.strip()
    except Exception as e:
        return f"Error parsing document: {str(e)}"
