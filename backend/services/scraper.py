"""
Web Scraper — Supports static (single page) and dynamic (full-site crawl with Playwright).
Static mode: scrapes only the given URLs using requests + BeautifulSoup.
Dynamic mode: crawls the ENTIRE website, discovering all internal subpages via Playwright.
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
import logging

logger = logging.getLogger(__name__)


def scrape_urls(urls, mode="static", max_pages=100):
    if mode == "dynamic":
        return _scrape_dynamic_fullsite(urls, max_pages=max_pages)
    
    # Even for static (single page), use Playwright if available to support JS-heavy websites
    try:
        from playwright.sync_api import sync_playwright
        return _scrape_dynamic_fullsite(urls, max_pages=1)
    except ImportError:
        logger.warning("Playwright not available — falling back to pure static scraping (JS will not be rendered).")
        return _scrape_static(urls)


def _scrape_static(urls):
    """Static scraping — scrapes only the given URLs using requests + BeautifulSoup."""
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
            logger.info(f"📄 Static scraping: {url}")
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()

            text = _extract_text_from_html(response.text, url)
            extracted.append(text)

        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            extracted.append(f"Source: {url}\nError: {str(e)}")

    return extracted


def _scrape_dynamic_fullsite(urls, max_pages=50):
    """Dynamic full-site crawling — discovers and scrapes ALL internal pages using Playwright."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("Playwright not installed — falling back to static scraping")
        return _scrape_static(urls)

    all_extracted = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            page = context.new_page()

            for start_url in urls:
                if not start_url:
                    continue
                if not start_url.startswith('http'):
                    start_url = 'https://' + start_url

                # Crawl entire site starting from this URL
                crawled = _crawl_site(page, start_url, max_pages=max_pages)
                all_extracted.extend(crawled)

            browser.close()
    except Exception as e:
        logger.error(f"Playwright error: {e}")
        logger.info("Falling back to static scraping...")
        return _scrape_static(urls)

    return all_extracted


def _crawl_site(page, start_url, max_pages=50):
    """Crawl an entire site starting from start_url, discovering internal links.
    
    Returns list of extracted text strings for each page.
    """
    parsed_start = urlparse(start_url)
    base_domain = parsed_start.netloc
    
    visited = set()
    to_visit = [start_url]
    extracted = []
    
    logger.info(f"🌐 Starting full-site crawl of {base_domain} (max {max_pages} pages)...")

    while to_visit and len(visited) < max_pages:
        url = to_visit.pop(0)
        
        # Normalize URL (remove fragment, trailing slash inconsistency)
        url = _normalize_url(url)
        
        if url in visited:
            continue
        
        # Skip non-HTML resources
        if _is_resource_url(url):
            continue
            
        visited.add(url)
        
        try:
            logger.info(f"  🔍 [{len(visited)}/{max_pages}] Crawling: {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # Wait a bit for dynamic content
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass  # Continue even if networkidle times out
            
            html = page.content()
            
            # Extract text from this page
            text = _extract_text_from_html(html, url)
            if text and "No content found" not in text:
                extracted.append(text)
            
            # Discover internal links on this page
            links = _extract_internal_links(html, url, base_domain)
            
            for link in links:
                normalized = _normalize_url(link)
                if normalized not in visited and normalized not in to_visit:
                    to_visit.append(normalized)
            
        except Exception as e:
            logger.warning(f"  ⚠️ Error crawling {url}: {e}")
            continue
    
    logger.info(f"✅ Crawl complete: {len(visited)} pages visited, {len(extracted)} pages with content extracted")
    return extracted


def _extract_internal_links(html, current_url, base_domain):
    """Extract all internal links from an HTML page."""
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href'].strip()
        
        # Skip empty, javascript:, mailto:, tel:, and anchor-only links
        if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:', 'data:')):
            continue
        
        # Resolve relative URLs
        absolute_url = urljoin(current_url, href)
        parsed = urlparse(absolute_url)
        
        # Only keep same-domain links
        if parsed.netloc == base_domain:
            # Remove fragment
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if parsed.query:
                clean_url += f"?{parsed.query}"
            links.add(clean_url)
    
    return links


def _normalize_url(url):
    """Normalize a URL for deduplication."""
    parsed = urlparse(url)
    # Remove fragment, remove trailing slash for consistency
    path = parsed.path.rstrip('/') if parsed.path != '/' else '/'
    normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def _is_resource_url(url):
    """Check if URL points to a non-HTML resource (image, PDF, etc.)."""
    resource_extensions = {
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
        '.zip', '.tar', '.gz', '.rar', '.7z',
        '.css', '.js', '.map', '.woff', '.woff2', '.ttf', '.eot',
        '.xml', '.rss', '.atom', '.json'
    }
    parsed = urlparse(url)
    path_lower = parsed.path.lower()
    return any(path_lower.endswith(ext) for ext in resource_extensions)


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

    return scrape_urls(urls, mode=mode, max_pages=max_pages)
