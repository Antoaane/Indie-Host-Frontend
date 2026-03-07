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
import re
from pathlib import Path
from typing import Any

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

# ---------------------------------------------------------------------------
# Helpers génériques
# ---------------------------------------------------------------------------

def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


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

def _fetch_with_playwright(url: str, proxy_url: str = "", headless: bool = False) -> str:
    proxy = {"server": proxy_url} if proxy_url else None

    with sync_playwright() as p:
        launch_kwargs: dict = {
            "proxy": proxy,
            "args": ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
        }
        if headless:
            launch_kwargs["headless"] = True
            launch_kwargs["args"] += ["--headless=new"]
        else:
            launch_kwargs["headless"] = False

        browser = p.chromium.launch(**launch_kwargs)
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="fr-FR",
            viewport={"width": 1280, "height": 900},
        )

        page = ctx.new_page()

        if HAS_STEALTH:
            Stealth().apply_stealth_sync(page)

        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
        """)

        page.goto(url, wait_until="domcontentloaded", timeout=45_000)

        if "chal_t" in page.url:
            try:
                page.wait_for_url(lambda u: "chal_t" not in u, timeout=30_000)
                page.wait_for_load_state("domcontentloaded", timeout=15_000)
            except Exception:
                pass

        for sel in [
            "#onetrust-accept-btn-handler",
            "button[id*='accept'][id*='cookie']",
            "button[data-testid='accept-button']",
        ]:
            try:
                btn = page.locator(sel).first
                if btn.is_visible(timeout=2_000):
                    btn.click()
                    page.wait_for_timeout(800)
                    break
            except Exception:
                continue

        try:
            page.wait_for_selector(
                "[data-testid='property-name'], h2.pp-header__title, "
                "#hp_hotel_name, [data-capla-component='PropertyHeader'], "
                ".hp__hotel-name",
                timeout=15_000,
            )
        except Exception:
            pass

        page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
        page.wait_for_timeout(1_500)

        html = page.content()
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
    Ordre : ScrapFly (si clé dispo) → Playwright → curl_cffi.
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

    # 2. Playwright
    if HAS_PLAYWRIGHT:
        for headless in (False, True):
            try:
                html = _fetch_with_playwright(url, proxy_url, headless=headless)
                if not _is_blocked_page(html) and len(html) > 10_000:
                    return html
            except Exception:
                continue

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
        return str(ld["name"]).strip()
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
            text = el.get_text(strip=True)
            if text:
                return text
    return ""


def _parse_description(soup: "BeautifulSoup", ld: dict | None) -> str:
    if ld and ld.get("description"):
        return str(ld["description"]).strip()
    for sel in [
        # Sélecteur ScrapFly (confirmé fonctionnel)
        "[data-capla-component-boundary='b-property-web-property-page/PropertyDescriptionDesktop']",
        "[data-testid='property-description']",
        "[data-capla-component='PropertyDescription']",
        "div#property_description_content",
        "div.hp_desc_main_content",
        "div.hotel_description_wrapper_exp",
    ]:
        el = soup.select_one(sel)
        if el:
            text = el.get_text(separator="\n", strip=True)
            if len(text) > 30:
                return text
    return ""


def _parse_address(addr: dict | None) -> dict:
    if not isinstance(addr, dict):
        return {}
    city = addr.get("addressLocality")
    if isinstance(city, dict):
        city = city.get("name")
    region = addr.get("addressRegion")
    country = addr.get("addressCountry")
    if isinstance(country, dict):
        country = country.get("name")
    return {"city": city, "region": region, "country": country}


def _parse_location_from_html(soup: "BeautifulSoup") -> dict:
    # Sélecteur ScrapFly : l'adresse complète est dans un span après #map_trigger_header_pin
    el = soup.select_one("#map_trigger_header_pin ~ span")
    if not el:
        for sel in [
            "[data-testid='PropertyHeaderAddressDesktop']",
            "span[data-testid='address']",
            "span.hp_address_subtitle",
            ".hp-address",
        ]:
            el = soup.select_one(sel)
            if el:
                break

    if el:
        text = el.get_text(strip=True)
        parts = [p.strip() for p in text.split(",")]
        result: dict = {}
        if parts:
            result["city"] = parts[0]
        if len(parts) >= 2:
            result["region"] = parts[1]
        if len(parts) >= 3:
            result["country"] = parts[2]
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
    rules: dict = {}
    for sel in [
        "[data-testid='property-policies']",
        "div.hp-policies-list",
        "div.policy-list",
        "[data-capla-component='PropertyPolicies']",
    ]:
        for block in soup.select(sel):
            text = block.get_text(separator=" ", strip=True)
            if "arrivée" in text.lower() or "check-in" in text.lower():
                rules["checkIn"] = text[:300]
            if "départ" in text.lower() or "check-out" in text.lower():
                rules["checkOut"] = text[:300]
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

    return 1


# ---------------------------------------------------------------------------
# Point d'entrée principal
# ---------------------------------------------------------------------------

def scrape_listing(url: str, proxy_url: str = "") -> dict:
    """
    Scrape une page Booking.com par URL directe.

    Méthodes dans l'ordre :
      1. ScrapFly (si SCRAPFLY_KEY définie) — contourne le WAF fiablement
      2. Playwright headless=False
      3. Playwright headless=True
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
    if not location.get("city"):
        location = _parse_location_from_html(soup)
    amenities = _parse_amenities(soup, ld)
    images = _parse_images(soup, ld)
    house_rules_data = _parse_house_rules(soup)
    capacity = _parse_capacity(soup, ld)

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
        "coordinates": {"latitude": lat, "longitude": lng} if lat is not None and lng is not None else {},
        "city": location.get("city"),
        "region": location.get("region"),
        "country": location.get("country"),
        "amenities": amenities,
        "images": images,
        "house_rules": house_rules,
        "person_capacity": capacity,
        "room_type": (ld.get("@type") or "Logement entier") if ld else "Logement entier",
    }
