import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from dateutil import parser as dt_parser
from datetime import datetime, timedelta
import hashlib


class NewsScraper:
    @staticmethod
    def get_root_rss(url) -> str:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}/rss"

    @staticmethod
    def get_root_url(url) -> str:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"

    @staticmethod
    def get_source_info(rss_url) -> dict:
        try:
            response = requests.get(rss_url, timeout=10)
            soup = BeautifulSoup(response.content, "xml")
            channel = soup.find("channel")
            if not channel:
                raise ValueError("We cannot get access to this source.")

            atom_link = soup.find("atom:link")

            # Extract name
            name = channel.title.text.strip() if channel and channel.title else ""

            # Extract <link> tag safely
            link_tag = channel.find("link") if channel else None
            root_url = ""

            if link_tag:
                if hasattr(link_tag, "text") and link_tag.text.startswith("http"):
                    root_url = link_tag.text.strip()
                elif isinstance(link_tag, str) and link_tag.startswith("http"):
                    root_url = link_tag.strip()

            # Fallback to root domain if <link> missing or broken
            if not root_url:
                parsed = urlparse(rss_url)
                root_url = f"{parsed.scheme}://{parsed.netloc}"

            return {
                "name": name,
                "link": root_url,
                "self_link": atom_link["href"] if atom_link and atom_link.has_attr("href") else rss_url,
            }

        except Exception as e:
            raise Exception("Could not parse the info.")

    @staticmethod
    def generate_title_hash(title: str, pub_date: datetime) -> str:
        raw = f"{title.strip().lower()}_{pub_date.isoformat()}"
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def get_articles_from_rss(rss_url, time_period_in_h=24, filter_hashes: set[str] = None) -> list[dict]:
        if filter_hashes is None:
            filter_hashes = []

        try:
            response = requests.get(rss_url)
            soup = BeautifulSoup(response.content, "xml")
            items = soup.find_all("item")

            articles = []
            now = datetime.now()
            cutoff = now - timedelta(hours=time_period_in_h)

            for item in items:
                title = item.title.text if item.title else ""
                description = item.description.text if item.description else ""
                link = item.link.text if item.link else ""
                pub_date_raw = item.pubDate.text if item.pubDate else None
                pub_date = dt_parser.parse(pub_date_raw).replace(tzinfo=None) if pub_date_raw else None

                if not pub_date or pub_date < cutoff:
                    continue

                title_hash = NewsScraper.generate_title_hash(title, pub_date)
                if title_hash in filter_hashes:
                    continue

                full_content = NewsScraper.scrape_article_content(link)

                articles.append(
                    {
                        "title": title,
                        "title_hash": title_hash,
                        "description": description,
                        "link": link,
                        "pub_date": pub_date,
                        "content": full_content,
                    }
                )

            return articles
        except Exception as e:
            print("Error scraping articles:", e)
            return []

    @staticmethod
    def scrape_article_content(article_url):
        try:
            resp = requests.get(article_url, timeout=5)
            soup = BeautifulSoup(resp.content, "html.parser")

            # Array of likely container selectors
            possible_containers = [
                {"name": "div", "class_": "article-content"},
                {"name": "div", "class_": "article-body"},
                {"name": "div", "class_": "entry-content"},
                {"name": "article", "class_": None},
                {"name": "div", "id": "main-content"},
            ]

            for selector in possible_containers:
                container = soup.find(selector["name"], class_=selector.get("class_"), id=selector.get("id"))
                if container:
                    paragraphs = container.find_all("p")
                    if paragraphs:
                        return "\n".join(p.get_text(strip=True) for p in paragraphs)

            # Fallback: get all <p> tags
            all_paragraphs = soup.find_all("p")
            return "\n".join(p.get_text(strip=True) for p in all_paragraphs)

        except Exception as e:
            print(f"Error scraping content from {article_url}: {e}")
            return ""
