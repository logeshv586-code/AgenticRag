import requests
from bs4 import BeautifulSoup
import re

def scrape_urls(urls):
    """
    Scrapes a list of URLs and extracts the main text content.
    Returns a list of extracted texts.
    """
    extracted = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    for url in urls:
        if not url:
            continue
        if not url.startswith('http'):
            url = 'https://' + url
            
        try:
            print(f"Scraping: {url}")
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove noise
            for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
                element.decompose()
                
            # Focus on main content if possible
            content = soup.find('main') or soup.find('article') or soup.body
            
            if content:
                # Get text with spacing
                text = content.get_text(separator='\n', strip=True)
                # Clean up multiple newlines
                text = re.sub(r'\n+', '\n', text)
                extracted.append(f"Source: {url}\n{text}")
            else:
                extracted.append(f"Source: {url}\nNo content found.")
                
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            extracted.append(f"Source: {url}\nError: {str(e)}")
            
    return extracted
