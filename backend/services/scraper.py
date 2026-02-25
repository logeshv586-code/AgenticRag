import requests
from bs4 import BeautifulSoup

def scrape_urls(urls):
    """
    Scrapes a list of URLs and extracts the main text content.
    Returns a list of extracted texts.
    """
    extracted = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    for url in urls:
        if not url:
            continue
        if not url.startswith('http'):
            url = 'https://' + url
            
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Remove scripts and styles
                for script in soup(["script", "style"]):
                    script.extract()
                    
                text = soup.get_text(separator=' ', strip=True)
                extracted.append(f"Source: {url}\n{text}")
            else:
                extracted.append(f"Source: {url}\nFailed to scrape: {response.status_code}")
        except Exception as e:
            extracted.append(f"Source: {url}\nError: {str(e)}")
            
    return extracted
