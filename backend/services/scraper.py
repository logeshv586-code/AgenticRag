"""
Web Scraper — Supports both static (BeautifulSoup) and dynamic (Playwright) pages.
"""
import requests
from bs4 import BeautifulSoup
import re
import logging

logger = logging.getLogger(__name__)


def scrape_urls(urls, mode="static"):
    """
    Scrapes a list of URLs and extracts the main text content.

    Args:
        urls: list of URL strings
        mode: "static" (requests + BS4) or "dynamic" (Playwright for JS-rendered pages)

    Returns:
        list of extracted text strings
    """
    if mode == "dynamic":
        return _scrape_dynamic(urls)
    return _scrape_static(urls)


def _scrape_static(urls):
    """Static scraping using requests + BeautifulSoup."""
    extracted = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    for url in urls:
        if not url:
            continue
        if not url.startswith('http'):
            url = 'https://' + url

        try:
            logger.info(f"Static scraping: {url}")
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()

            text = _extract_text_from_html(response.text, url)
            extracted.append(text)

        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            extracted.append(f"Source: {url}\nError: {str(e)}")

    return extracted


def _scrape_dynamic(urls):
    """Dynamic scraping using Playwright for JS-rendered pages."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("Playwright not installed — falling back to static scraping")
        return _scrape_static(urls)

    extracted = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            for url in urls:
                if not url:
                    continue
                if not url.startswith('http'):
                    url = 'https://' + url

                try:
                    logger.info(f"Dynamic scraping: {url}")
                    page.goto(url, wait_until="networkidle", timeout=30000)
                    html = page.content()
                    text = _extract_text_from_html(html, url)
                    extracted.append(text)
                except Exception as e:
                    logger.error(f"Error scraping {url}: {e}")
                    extracted.append(f"Source: {url}\nError: {str(e)}")

            browser.close()
    except Exception as e:
        logger.error(f"Playwright error: {e}")
        return _scrape_static(urls)

    return extracted


def _extract_text_from_html(html: str, url: str) -> str:
    """Extract clean text content from HTML string."""
    soup = BeautifulSoup(html, 'html.parser')

    # Remove noise elements
    for element in soup(["script", "style", "nav", "footer", "header", "aside",
                          "noscript", "iframe", "svg"]):
        element.decompose()

    # Priority: article > main > body
    content = soup.find('article') or soup.find('main') or soup.body

    if content:
        text = content.get_text(separator='\n', strip=True)
        text = re.sub(r'\n{3,}', '\n\n', text)  # collapse multiple newlines
        text = re.sub(r'[ \t]+', ' ', text)  # collapse whitespace
        return f"Source: {url}\n{text}"
    else:
        return f"Source: {url}\nNo content found."


def scrape_sitemap(base_url: str, mode="static", max_pages=20):
    """
    Discover pages from sitemap.xml and scrape them.

    Args:
        base_url: root URL of the site (e.g. https://example.com)
        mode: "static" or "dynamic"
        max_pages: maximum number of pages to scrape

    Returns:
        list of extracted text strings
    """
    sitemap_url = base_url.rstrip('/') + '/sitemap.xml'
    urls = []

    try:
        resp = requests.get(sitemap_url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'xml')
        locs = soup.find_all('loc')
        urls = [loc.text for loc in locs[:max_pages]]
    except Exception as e:
        logger.warning(f"Could not fetch sitemap: {e}")
        urls = [base_url]

    return scrape_urls(urls, mode=mode)
