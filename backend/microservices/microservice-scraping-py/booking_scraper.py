"""
Scraper Booking.com par URL directe.

Méthodes (par ordre de priorité) :
  1. ScrapFly SDK  (si SCRAPFLY_KEY est défini dans l'environnement)
     → Free tier : 1000 requêtes/mois sur https://scrapfly.io
     → Contourne le WAF Booking.com de façon fiable
  2. Playwright    (si scrapfly-sdk absent ou clé non configurée)
  3. curl_cffi     (dernier recours)

Configuration rapide ScrapFly :
    1. Créer un compte gratuit sur https://scrapfly.io
    2. Copier la clé API dans .env ou définir :
         set SCRAPFLY_KEY=votre_cle   (Windows)
         export SCRAPFLY_KEY=votre_cle  (Linux/macOS)
    3. pip install scrapfly-sdk
"""
import json
import os
import random
import re
import time
from html import unescape
from pathlib import Path
from typing import Any

from booking_amenity_mapping import translate_booking_amenities_to_indiehost

# Charge le .env dès l'import du module (même si appelé standalone)
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).parent / ".env")
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Imports optionnels
# ---------------------------------------------------------------------------

try:
    from scrapfly import ScrapeConfig, ScrapflyClient
    HAS_SCRAPFLY = True
except ImportError:
    HAS_SCRAPFLY = False

try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL = True
except ImportError:
    HAS_CURL = False

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

try:
    from playwright.sync_api import sync_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

try:
    from playwright_stealth import Stealth
    HAS_STEALTH = True
except ImportError:
    HAS_STEALTH = False

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

LODGING_TYPES = {
    "Hotel", "LodgingBusiness", "Motel", "BedAndBreakfast", "Resort",
    "Hostel", "VacationRental", "Apartment", "Room", "Suite",
    "HouseRental", "CampingPitch",
}

BOOKING_BLOCKED_ERROR = (
    "Booking.com bloque le scraping automatique sur cette annonce. "
    "Essayez avec un lien Airbnb, ou entrez les informations manuellement."
)
BOOKING_PLAYWRIGHT_USER_AGENTS = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36",
)
PRICE_NUMBER_RE = re.compile(r"(\d[\d\s\xa0.,]*)")
REVIEW_COUNT_RE = re.compile(r"(\d[\d\s\xa0.,]*)\s*(?:reviews?|avis)\b", re.IGNORECASE)
ROOM_COUNT_PATTERNS = {
    "guest_capacity": (
        re.compile(r"(?P<count>\d+|one|a|an)\s+(?:guest|guests|adult|adults|person|persons|people|voyageur|voyageurs)", re.IGNORECASE),
    ),
    "bedrooms": (
        re.compile(r"(?P<count>\d+|one|a|an)\s+(?:bedroom|bedrooms|chambre|chambres)", re.IGNORECASE),
    ),
    "beds": (
        re.compile(r"(?P<count>\d+|one|a|an)\s+(?:bed|beds|lit|lits)\b", re.IGNORECASE),
    ),
    "bathrooms": (
        re.compile(r"(?P<count>\d+|one|a|an)\s+(?:bathroom|bathrooms|bath|baths|salle(?:s)? de bain(?:s)?)", re.IGNORECASE),
    ),
    "kitchens": (
        re.compile(r"(?P<count>\d+|one|a|an)\s+(?:kitchen|kitchens|cuisine|cuisines)\b", re.IGNORECASE),
    ),
}
DESCRIPTION_SELECTORS = (
    "#summary p",
    "#summary",
    "[data-capla-component-boundary='b-property-web-property-page/PropertyDescriptionDesktop'] p",
    "[data-capla-component-boundary='b-property-web-property-page/PropertyDescriptionDesktop']",
    "[data-testid='property-description'] p",
    "[data-testid='property-description']",
    "[data-capla-component='PropertyDescription']",
    "div#property_description_content",
    "div.hp_desc_main_content",
    "div.hotel_description_wrapper_exp",
)
ADDRESS_SELECTORS = (
    "#showMap2 span[data-source='top_link']",
    "#map_trigger_header_pin ~ span",
    "[data-testid='PropertyHeaderAddressDesktop']",
    "span[data-testid='address']",
    "span.hp_address_subtitle",
    ".hp-address",
)
PRICE_SELECTORS = (
    "div[data-testid='price-and-discounted-price']",
    "[data-testid='price-for-x-nights']",
    "[data-testid='recommended-price']",
    "[data-testid='availability-rate-information']",
    "[data-testid='product-price']",
    "meta[itemprop='price']",
)
REVIEW_SELECTORS = (
    "div[data-testid='review-score']",
    "[data-testid='review-score-component']",
    "[data-testid='review-score-right-component']",
    "a[data-testid*='review-score-link']",
    "[class*='review-score']",
)
OVERVIEW_SELECTORS = (
    "[data-testid='property-most-popular-facilities'] li",
    "[data-testid='property-section--content'] li",
    "[data-testid='property-section--content'] span",
    "[data-testid='room-info'] span",
    "[data-testid='property-rooms'] span",
    "#summary li",
    "#summary span",
)
ROOM_TYPE_SELECTORS = (
    "[data-testid='property-type-badge']",
    "[data-testid='property-header-subtitle']",
    ".hp__hotel-type",
    "meta[property='og:type']",
)
HOUSE_RULE_SELECTORS = (
    "[data-testid='property-policies']",
    "div.hp-policies-list",
    "div.policy-list",
    "[data-capla-component='PropertyPolicies']",
)

# ---------------------------------------------------------------------------
# Helpers génériques
# ---------------------------------------------------------------------------

def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", unescape(str(value))).strip()


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        if isinstance(val, str):
            normalized = _clean_text(val).replace(",", ".")
            match = re.search(r"-?\d+(?:\.\d+)?", normalized)
            if match:
                try:
                    return float(match.group(0))
                except ValueError:
                    return None
        return None


def _coerce_price(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return int(round(value)) if value > 0 else None

    text = _clean_text(value)
    if not text:
        return None

    for match in PRICE_NUMBER_RE.findall(text):
        digits = re.sub(r"[^\d]", "", match)
        if not digits:
            continue
        price = int(digits)
        if 0 < price < 1_000_000:
            return price
    return None


def _coerce_rating(value: Any) -> float | None:
    number = _safe_float(value)
    if number is None:
        return None
    if number < 0 or number > 10:
        return None
    return round(number, 2)


def _walk(value: Any):
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _dedupe_texts(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = _clean_text(value)
        if not clean:
            continue
        key = clean.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(clean)
    return out


def _parse_count_token(value: str) -> int | None:
    normalized = _clean_text(value).casefold()
    if not normalized:
        return None
    if normalized.isdigit():
        return int(normalized)
    if normalized in {"one", "a", "an"}:
        return 1
    return None


def _split_location_parts(text: str) -> dict:
    clean = _clean_text(text)
    if not clean:
        return {}

    parts = [part.strip() for part in clean.split(",") if _clean_text(part)]
    if len(parts) >= 4:
        street = ", ".join(parts[:-3])
        city, region, country = parts[-3], parts[-2], parts[-1]
    elif len(parts) == 3:
        street = ""
        city, region, country = parts[0], parts[1], parts[2]
    elif len(parts) == 2:
        street = ""
        city, region, country = parts[0], "", parts[1]
    else:
        street = ""
        city, region, country = parts[0], "", ""

    precise_parts = [part for part in (street, city, region, country) if part]
    return {
        "precise_address": ", ".join(precise_parts) if precise_parts else clean,
        "city": city or None,
        "region": region or None,
        "country": country or None,
    }


def _parse_room_counts_from_texts(texts: list[str], fallback_capacity: int | None = None) -> dict:
    counts: dict[str, int] = {}
    for text in texts:
        for key, patterns in ROOM_COUNT_PATTERNS.items():
            for pattern in patterns:
                match = pattern.search(text)
                if not match:
                    continue
                parsed = _parse_count_token(match.group("count"))
                if parsed is None:
                    continue
                counts[key] = max(counts.get(key, 0), parsed)
    if fallback_capacity and fallback_capacity > 0:
        counts["guest_capacity"] = max(counts.get("guest_capacity", 0), fallback_capacity)
    return counts


def _upgrade_image_url(url: str) -> str:
    """Convertit une URL miniature Booking en URL haute résolution."""
    url = re.sub(r"/max\d+x?\d*/", "/max1280x900/", url)
    url = re.sub(r"[?&](width|height|w|h)=\d+", "", url)
    return url


def _is_blocked_page(html: str) -> bool:
    """
    Détecte une vraie page de challenge / bot-block.

    Attention : Booking.com inclut des scripts AWS WAF (challenge.js,
    WafCookieDomainList) sur TOUTES ses pages légitimes. Ces marqueurs
    ne suffisent pas à conclure à un blocage si la page est grande (>100 KB)
    et contient du contenu de propriété.
    """
    # Page trop courte = certainement une page de challenge, pas une vraie page
    if len(html) < 20_000:
        return True

    cf_markers = [
        "cf-browser-verification", "challenge-form", "cf_clearance",
        "Ray ID", "Checking your browser", "DDoS protection",
        "Please Wait", "Verifying you are human",
    ]
    # Marqueurs stricts qui indiquent une vraie page de challenge Booking
    # (présents uniquement quand Booking bloque, pas sur les pages légitimes)
    hard_block_markers = [
        "chal_t=",
        "JavaScript is disabled",
        "force_referer=",
    ]
    html_lower = html.lower()

    # Cloudflare challenge
    cf_score = sum(1 for m in cf_markers if m.lower() in html_lower[:8000])
    if cf_score >= 2:
        return True

    # Marqueurs de blocage stricts Booking
    hard_score = sum(1 for m in hard_block_markers if m.lower() in html_lower)
    if hard_score >= 1:
        return True

    return False


# ---------------------------------------------------------------------------
# Méthode 1 : ScrapFly (contourne le WAF Booking.com de façon fiable)
# ---------------------------------------------------------------------------

def _fetch_with_scrapfly(url: str) -> str:
    """
    Utilise l'API ScrapFly avec anti-scraping protection (asp=True).
    Requiert la variable d'environnement SCRAPFLY_KEY.
    Free tier : 1000 req/mois — https://scrapfly.io
    """
    api_key = os.environ.get("SCRAPFLY_KEY", "")
    if not api_key:
        raise RuntimeError("SCRAPFLY_KEY non définie")

    client = ScrapflyClient(key=api_key)
    result = client.scrape(
        ScrapeConfig(
            url=url,
            asp=True,            # Anti-Scraping Protection — bypass WAF Booking.com
            country="US",        # IP US — plus fiable pour bypasser le WAF
            render_js=True,      # Obligatoire : Booking résout le challenge JS côté client
            rendering_wait=5000, # 5s pour que le challenge JS se résolve + contenu chargé
            headers={
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
    )
    return result.content


# ---------------------------------------------------------------------------
# Méthode 2 : Playwright
# ---------------------------------------------------------------------------

def _playwright_random_delay(min_sec: float = 0.6, max_sec: float = 1.8) -> None:
    time.sleep(random.uniform(min_sec, max_sec))


def _playwright_simulate_human_mouse(page: Any) -> None:
    viewport = page.viewport_size or {"width": 1280, "height": 800}
    width = max(int(viewport.get("width", 1280)), 320)
    height = max(int(viewport.get("height", 800)), 320)
    for _ in range(random.randint(2, 4)):
        page.mouse.move(
            random.randint(0, width - 1),
            random.randint(0, height - 1),
            steps=random.randint(6, 16),
        )
        _playwright_random_delay(0.15, 0.45)


def _dismiss_booking_overlays(page: Any) -> None:
    for sel in [
        "#onetrust-accept-btn-handler",
        "button[data-testid='accept-button']",
        "button[aria-label='Dismiss sign-in info.']",
        "button[aria-label='Ignorer les infos de connexion']",
    ]:
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=1_500):
                btn.click()
                page.wait_for_timeout(900)
        except Exception:
            continue


def _fetch_with_playwright(url: str, proxy_url: str = "", headless: bool = True) -> str:
    proxy = {"server": proxy_url} if proxy_url else None

    with sync_playwright() as p:
        launch_kwargs: dict = {
            "proxy": proxy,
            "args": ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
        }
        launch_kwargs["headless"] = headless
        if headless:
            launch_kwargs["args"] += ["--headless=new"]

        browser = p.chromium.launch(**launch_kwargs)
        ctx = browser.new_context(
            user_agent=random.choice(BOOKING_PLAYWRIGHT_USER_AGENTS),
            locale="en-US",
            timezone_id="Europe/Paris",
            viewport={"width": 1280, "height": 800},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
            },
        )

        page = ctx.new_page()

        if HAS_STEALTH:
            Stealth().apply_stealth_sync(page)

        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
            window.chrome = { runtime: {} };
        """)

        # On reprend ici l'idée clé du repo fourni : "chauffer" une vraie session
        # Booking avant d'ouvrir la page hôtel, même en headless.
        page.goto("https://www.booking.com", wait_until="domcontentloaded", timeout=60_000)
        _playwright_random_delay(2.0, 3.2)
        _dismiss_booking_overlays(page)
        _playwright_simulate_human_mouse(page)
        page.evaluate("window.scrollBy(0, window.innerHeight / 3)")
        _playwright_random_delay(1.0, 2.0)

        page.goto(url, wait_until="domcontentloaded", timeout=60_000)

        if "chal_t" in page.url:
            try:
                page.wait_for_url(lambda u: "chal_t" not in u, timeout=30_000)
                page.wait_for_load_state("domcontentloaded", timeout=15_000)
            except Exception:
                pass

        _playwright_random_delay(3.5, 5.5)
        _dismiss_booking_overlays(page)
        _playwright_simulate_human_mouse(page)

        for sel in [
            "button:has-text('Show me more')",
            "button:has-text('Read more')",
            "button:has-text('Afficher plus')",
            "button:has-text('Voir plus')",
            "div.hp-description__show_more--visible a",
        ]:
            try:
                btn = page.locator(sel).first
                if btn.is_visible(timeout=1_500):
                    btn.click()
                    page.wait_for_timeout(800)
                    break
            except Exception:
                continue

        for sel in [
            "button:has-text('Show all facilities')",
            "button:has-text('Show all amenities')",
            "button:has-text('Afficher les équipements')",
            "button:has-text('Afficher tous les équipements')",
        ]:
            try:
                btn = page.locator(sel).first
                if btn.is_visible(timeout=1_500):
                    btn.click()
                    page.wait_for_timeout(800)
                    break
            except Exception:
                continue

        try:
            page.wait_for_selector(
                "[data-testid='property-name'], h2.pp-header__title, "
                "#hp_hotel_name, [data-capla-component='PropertyHeader'], "
                ".hp__hotel-name, h2",
                timeout=20_000,
            )
        except Exception:
            pass

        page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
        _playwright_random_delay(1.0, 1.8)

        html = page.content()
        ctx.close()
        browser.close()
    return html


# ---------------------------------------------------------------------------
# Méthode 3 : curl_cffi
# ---------------------------------------------------------------------------

def _fetch_with_curl(url: str, proxy_url: str = "") -> str:
    if not HAS_CURL:
        raise RuntimeError("curl_cffi requis : pip install curl_cffi")
    proxies = {}
    if proxy_url:
        proxies = {"http": proxy_url, "https": proxy_url}
    resp = cffi_requests.get(
        url,
        headers=DEFAULT_HEADERS,
        proxies=proxies,
        timeout=30,
        impersonate="chrome120",
    )
    resp.raise_for_status()
    return resp.text


# ---------------------------------------------------------------------------
# Orchestrateur : essaie les méthodes dans l'ordre
# ---------------------------------------------------------------------------

def _fetch_html(url: str, proxy_url: str = "") -> str:
    """
    Ordre : ScrapFly (si clé dispo) → Playwright headless → curl_cffi.
    Lève RuntimeError(BOOKING_BLOCKED_ERROR) si tout échoue.
    """
    # 1. ScrapFly — méthode la plus fiable contre le WAF Booking.com
    if HAS_SCRAPFLY and os.environ.get("SCRAPFLY_KEY"):
        try:
            html = _fetch_with_scrapfly(url)
            if not _is_blocked_page(html) and len(html) > 10_000:
                return html
        except Exception:
            pass  # passe à Playwright

    # 2. Playwright headless, avec navigation initiale via la home Booking
    # inspirée du repo hotel-scraper pour obtenir une session plus crédible.
    if HAS_PLAYWRIGHT:
        try:
            html = _fetch_with_playwright(url, proxy_url, headless=True)
            if not _is_blocked_page(html) and len(html) > 10_000:
                return html
        except Exception:
            pass

    # 3. curl_cffi
    if HAS_CURL:
        try:
            html = _fetch_with_curl(url, proxy_url)
            if not _is_blocked_page(html) and len(html) > 10_000:
                return html
        except Exception:
            pass

    raise RuntimeError(BOOKING_BLOCKED_ERROR)


# ---------------------------------------------------------------------------
# Extraction JSON-LD
# ---------------------------------------------------------------------------

def _extract_json_ld(soup: "BeautifulSoup") -> dict | None:
    for tag in soup.select('script[type="application/ld+json"]'):
        raw = tag.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        candidates = data if isinstance(data, list) else [data]
        for item in candidates:
            if not isinstance(item, dict):
                continue
            t = item.get("@type", "")
            types = t if isinstance(t, list) else [t]
            if any(str(x) in LODGING_TYPES or "Lodging" in str(x) for x in types):
                return item
    return None


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def _parse_title(soup: "BeautifulSoup", ld: dict | None) -> str:
    if ld and ld.get("name"):
        return _clean_text(ld["name"])
    for sel in [
        "h2",                               # ScrapFly selector (le plus fiable)
        "[data-testid='property-name']",
        "h2.pp-header__title",
        "h1.hotel-name",
        "h2#hp_hotel_name",
        "#hp_hotel_name_homepage",
    ]:
        el = soup.select_one(sel)
        if el:
            text = _clean_text(el.get_text(strip=True))
            if text:
                return text
    return ""


def _parse_description(soup: "BeautifulSoup", ld: dict | None) -> str:
    if ld and ld.get("description"):
        return _clean_text(ld["description"])

    blocks: list[str] = []
    for sel in DESCRIPTION_SELECTORS:
        for el in soup.select(sel):
            text = _clean_text(el.get_text(separator="\n", strip=True))
            if len(text) > 30:
                blocks.append(text)

    deduped = _dedupe_texts(blocks)
    if deduped:
        return "\n\n".join(deduped)
    return ""


def _parse_address(addr: dict | None) -> dict:
    if not isinstance(addr, dict):
        return {}
    city = addr.get("addressLocality") or addr.get("city")
    if isinstance(city, dict):
        city = city.get("name")
    region = addr.get("addressRegion") or addr.get("region") or addr.get("state")
    country = addr.get("addressCountry") or addr.get("country")
    if isinstance(country, dict):
        country = country.get("name")
    street = (
        addr.get("streetAddress")
        or addr.get("addressLine1")
        or addr.get("line1")
        or addr.get("formattedStreetAddress")
    )
    precise_parts = [_clean_text(part) for part in (street, city, region, country) if _clean_text(part)]
    return {
        "precise_address": ", ".join(precise_parts) if precise_parts else "",
        "city": _clean_text(city) or None,
        "region": _clean_text(region) or None,
        "country": _clean_text(country) or None,
    }


def _parse_location_from_html(soup: "BeautifulSoup") -> dict:
    for sel in ADDRESS_SELECTORS:
        el = soup.select_one(sel)
        if el:
            result = _split_location_parts(el.get_text(strip=True))
            if result:
                return result
    return {}


def _parse_coordinates(soup: "BeautifulSoup", ld: dict | None) -> tuple[float | None, float | None]:
    if ld:
        geo = ld.get("geo")
        if isinstance(geo, dict):
            lat = _safe_float(geo.get("latitude"))
            lng = _safe_float(geo.get("longitude"))
            if lat is not None and lng is not None:
                return lat, lng

    # Sélecteur ScrapFly : .show_map_hp_link[data-atlas-latlng]
    for sel in [
        ".show_map_hp_link",
        "[data-atlas-latlng]",
        "#hotel_sidebar_static_map",
        "[data-coordinates]",
    ]:
        el = soup.select_one(sel)
        if el:
            raw = el.get("data-atlas-latlng") or el.get("data-coordinates") or ""
            parts = raw.split(",")
            if len(parts) >= 2:
                lat = _safe_float(parts[0].strip())
                lng = _safe_float(parts[1].strip())
                if lat is not None and lng is not None:
                    return lat, lng

    return None, None


def _parse_price(soup: "BeautifulSoup", ld: dict | None) -> int | None:
    if ld:
        offers = ld.get("offers")
        if isinstance(offers, dict):
            for key in ("price", "lowPrice", "highPrice"):
                value = _coerce_price(offers.get(key))
                if value is not None:
                    return value
        elif isinstance(offers, list):
            for offer in offers:
                if not isinstance(offer, dict):
                    continue
                for key in ("price", "lowPrice", "highPrice"):
                    value = _coerce_price(offer.get(key))
                    if value is not None:
                        return value

    for sel in PRICE_SELECTORS:
        for el in soup.select(sel):
            if el.name == "meta":
                value = _coerce_price(el.get("content", ""))
            else:
                value = _coerce_price(el.get_text(" ", strip=True))
            if value is not None:
                return value
    return None


def _parse_review_metrics(soup: "BeautifulSoup", ld: dict | None) -> tuple[float | None, int | None]:
    if ld:
        aggregate = ld.get("aggregateRating")
        if isinstance(aggregate, dict):
            rating = _coerce_rating(
                aggregate.get("ratingValue")
                or aggregate.get("rating_value")
                or aggregate.get("value")
            )
            review_count = _coerce_price(
                aggregate.get("reviewCount")
                or aggregate.get("ratingCount")
            )
            if rating is not None or review_count is not None:
                return rating, review_count

    rating: float | None = None
    review_count: int | None = None

    for sel in REVIEW_SELECTORS:
        for el in soup.select(sel):
            text = _clean_text(el.get_text(" ", strip=True))
            if not text:
                continue
            if rating is None:
                rating = _coerce_rating(text)
            if review_count is None:
                match = REVIEW_COUNT_RE.search(text)
                if match:
                    review_count = _coerce_price(match.group(1))
            if rating is not None and review_count is not None:
                return rating, review_count

    return rating, review_count


def _parse_overview_items(soup: "BeautifulSoup", ld: dict | None) -> list[str]:
    items: list[str] = []

    if ld:
        occupancy = ld.get("occupancy")
        if isinstance(occupancy, dict):
            max_value = occupancy.get("maxValue") or occupancy.get("value")
            if max_value:
                items.append(f"{max_value} guests")
        elif occupancy:
            items.append(f"{occupancy} guests")

    for sel in OVERVIEW_SELECTORS:
        for el in soup.select(sel):
            text = _clean_text(el.get_text(" ", strip=True))
            if not text or len(text) > 90:
                continue
            if any(pattern.search(text) for patterns in ROOM_COUNT_PATTERNS.values() for pattern in patterns):
                items.append(text)

    return _dedupe_texts(items)


def _parse_room_counts(soup: "BeautifulSoup", ld: dict | None, capacity: int | None) -> dict:
    counts: dict[str, int] = {}

    if ld:
        if ld.get("numberOfRooms"):
            parsed = _coerce_price(ld.get("numberOfRooms"))
            if parsed is not None:
                counts["bedrooms"] = parsed
        if ld.get("numberOfBedrooms"):
            parsed = _coerce_price(ld.get("numberOfBedrooms"))
            if parsed is not None:
                counts["bedrooms"] = parsed

    overview_items = _parse_overview_items(soup, ld)
    parsed_from_overview = _parse_room_counts_from_texts(overview_items, fallback_capacity=capacity)
    for key, value in parsed_from_overview.items():
        counts[key] = max(counts.get(key, 0), value)

    return counts


def _parse_room_type(soup: "BeautifulSoup", ld: dict | None) -> str:
    if ld and ld.get("@type"):
        raw_type = ld.get("@type")
        if isinstance(raw_type, list):
            for item in raw_type:
                text = _clean_text(item)
                if text:
                    return text
        text = _clean_text(raw_type)
        if text:
            return text

    for sel in ROOM_TYPE_SELECTORS:
        el = soup.select_one(sel)
        if not el:
            continue
        text = _clean_text(el.get("content") if el.name == "meta" else el.get_text(" ", strip=True))
        if text:
            return text
    return "Logement entier"


def _parse_location_descriptions(location: dict) -> list[dict]:
    precise_address = _clean_text(location.get("precise_address"))
    if not precise_address:
        return []
    return [{"title": precise_address, "content": ""}]


def _parse_amenities(soup: "BeautifulSoup", ld: dict | None) -> list[dict]:
    groups: dict[str, list[str]] = {}

    if ld:
        features = ld.get("amenityFeature") or []
        if isinstance(features, list):
            for f in features:
                name = f.get("name") if isinstance(f, dict) else str(f)
                if name:
                    groups.setdefault("Équipements", [])
                    if name not in groups["Équipements"]:
                        groups["Équipements"].append(name)

    # Sélecteur ScrapFly (confirmé) + sélecteurs de fallback
    facility_selectors = [
        "div[data-testid='property-section--content'] div:nth-child(2) li",  # ScrapFly
        "[data-testid='property-facilities'] li",
        "[data-testid='property-amenities'] li",
        "[data-capla-component='PropertyFacilities'] li",
        "div.facilitiesChecklistSection li",
        "div.important_facility",
        "[data-testid='property-most-popular-facilities'] li",
        ".hp-facility-block li",
    ]
    for sel in facility_selectors:
        for el in soup.select(sel):
            text = el.get_text(strip=True)
            if text and len(text) > 1:
                section = el.find_parent(
                    lambda tag: tag.name in ("section", "div")
                    and tag.get("class")
                    and any("section" in c or "category" in c for c in tag.get("class", []))
                )
                cat = "Équipements"
                if section:
                    h = section.select_one("h5, h4, h3, [class*='title']")
                    if h:
                        cat = h.get_text(strip=True) or cat
                groups.setdefault(cat, [])
                if text not in groups[cat]:
                    groups[cat].append(text)

    return [
        {"title": cat, "values": [{"title": v, "available": True} for v in vals]}
        for cat, vals in groups.items()
        if vals
    ]


def _is_property_image(url: str) -> bool:
    if not url or not url.startswith("http"):
        return False
    if "xdata/images/hotel" in url or "xdata/images/property" in url:
        return True
    excluded = ("/flags/", "/static/img/", "/tfl/", "/icons/", "pixel", "tracking", "logo")
    return not any(ex in url for ex in excluded)


def _parse_images(soup: "BeautifulSoup", ld: dict | None) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()

    def _add(url: str, title: str = "") -> None:
        url = _upgrade_image_url(url)
        if url and url not in seen and _is_property_image(url):
            seen.add(url)
            out.append({"url": url, "title": title or f"Photo {len(out) + 1}"})

    if ld:
        imgs = ld.get("image") or []
        if isinstance(imgs, str):
            imgs = [imgs]
        for item in imgs:
            if isinstance(item, str):
                _add(item)
            elif isinstance(item, dict):
                _add(item.get("url", "") or item.get("contentUrl", ""))

    # Sélecteur ScrapFly + sélecteurs modernes Booking 2024/2025
    gallery_selectors = [
        "#photo_wrapper img",                        # ScrapFly selector
        "div[data-component='gallery-side-reviews'] img",
        "div[aria-hidden='true'] img",
        "[data-testid='property-gallery'] img",
        "[data-capla-component='Gallery'] img",
        ".bh-photo-grid img",
        ".bh-photo-modal-grid img",
        "[data-testid='bui-gallery'] img",
        "figure img",
        "img[class*='photo']",
    ]
    for sel in gallery_selectors:
        for img in soup.select(sel):
            src = (
                img.get("data-lazy-src")
                or img.get("data-src")
                or img.get("src")
                or ""
            )
            _add(src, img.get("alt", ""))

    if len(out) < 3:
        for img in soup.select("img[src]"):
            _add(img.get("src", ""), img.get("alt", ""))

    return out


def _parse_house_rules(soup: "BeautifulSoup") -> dict:
    check_in_values: list[str] = []
    check_out_values: list[str] = []
    for sel in HOUSE_RULE_SELECTORS:
        for block in soup.select(sel):
            texts = [
                _clean_text(part)
                for part in block.stripped_strings
                if _clean_text(part)
            ]
            for text in texts:
                lowered = text.casefold()
                if "check-in" in lowered or "check in" in lowered or "arrivée" in lowered:
                    check_in_values.append(text)
                if "check-out" in lowered or "check out" in lowered or "départ" in lowered:
                    check_out_values.append(text)
    rules: dict[str, str] = {}
    if check_in_values:
        rules["checkIn"] = _dedupe_texts(check_in_values)[0]
    if check_out_values:
        rules["checkOut"] = _dedupe_texts(check_out_values)[0]
    return rules


def _parse_capacity(soup: "BeautifulSoup", ld: dict | None) -> int:
    if ld:
        occ = ld.get("occupancy")
        if isinstance(occ, dict):
            v = occ.get("maxValue") or occ.get("value")
            if v:
                return int(v)
        if isinstance(occ, (int, float)):
            return int(occ)

    for sel in [
        "[data-testid='occupancy-max']",
        "span[class*='persons']",
        "div[data-testid='room-info'] span",
    ]:
        el = soup.select_one(sel)
        if el:
            m = re.search(r"\d+", el.get_text())
            if m:
                return int(m.group())

    overview_items = _parse_overview_items(soup, ld)
    room_counts = _parse_room_counts_from_texts(overview_items)
    if room_counts.get("guest_capacity"):
        return room_counts["guest_capacity"]

    return 1


# ---------------------------------------------------------------------------
# Point d'entrée principal
# ---------------------------------------------------------------------------

def scrape_listing(url: str, proxy_url: str = "") -> dict:
    """
    Scrape une page Booking.com par URL directe.

    Méthodes dans l'ordre :
      1. ScrapFly (si SCRAPFLY_KEY définie) — contourne le WAF fiablement
      2. Playwright headless avec warm-up sur la home Booking
      4. curl_cffi

    Free tier ScrapFly : https://scrapfly.io (1000 req/mois gratuit)
    """
    if not HAS_BS4:
        raise RuntimeError("beautifulsoup4 requis : pip install beautifulsoup4")

    url = url.strip()
    if not url.startswith("http"):
        url = f"https://www.booking.com/hotel/{url}"
    if "booking.com" not in url.lower():
        raise ValueError("L'URL doit pointer vers booking.com")

    html = _fetch_html(url, proxy_url)
    soup = BeautifulSoup(html, "html.parser")
    ld = _extract_json_ld(soup)

    title = _parse_title(soup, ld)
    description = _parse_description(soup, ld)
    lat, lng = _parse_coordinates(soup, ld)
    location = _parse_address(ld.get("address")) if ld else {}
    html_location = _parse_location_from_html(soup)
    if html_location:
        location = {
            "precise_address": location.get("precise_address") or html_location.get("precise_address"),
            "city": location.get("city") or html_location.get("city"),
            "region": location.get("region") or html_location.get("region"),
            "country": location.get("country") or html_location.get("country"),
        }
    amenities = _parse_amenities(soup, ld)
    amenities_indiehost = translate_booking_amenities_to_indiehost(amenities)
    images = _parse_images(soup, ld)
    house_rules_data = _parse_house_rules(soup)
    capacity = _parse_capacity(soup, ld)
    price = _parse_price(soup, ld)
    average_rating, review_count = _parse_review_metrics(soup, ld)
    overview_items = _parse_overview_items(soup, ld)
    room_counts = _parse_room_counts(soup, ld, capacity)
    room_type = _parse_room_type(soup, ld)
    location_descriptions = _parse_location_descriptions(location)

    house_rules: dict = {}
    if house_rules_data:
        general = []
        if house_rules_data.get("checkIn"):
            general.append({"title": "Arrivée", "values": [{"title": house_rules_data["checkIn"]}]})
        if house_rules_data.get("checkOut"):
            general.append({"title": "Départ", "values": [{"title": house_rules_data["checkOut"]}]})
        if general:
            house_rules["general"] = general

    return {
        "listing_url": url,
        "source": "booking",
        "title": title,
        "description": description,
        "price": price,
        "average_rating": average_rating,
        "review_count": review_count,
        "coordinates": {"latitude": lat, "longitude": lng} if lat is not None and lng is not None else {},
        "precise_address": location.get("precise_address"),
        "city": location.get("city"),
        "region": location.get("region"),
        "country": location.get("country"),
        "overview_items": overview_items,
        "room_counts": room_counts,
        "amenities": amenities,
        "amenities_indiehost": amenities_indiehost,
        "images": images,
        "house_rules": house_rules,
        "person_capacity": capacity,
        "room_type": room_type,
        "location_descriptions": location_descriptions,
    }
