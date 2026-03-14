"""
Scraper Airbnb base sur gobnb (https://github.com/johnbalvin/pybnb).
Retourne un format normalise pour l'import frontend, meme en fallback.
"""
import argparse
import html
import json
import random
import re
import sys
import time
import errno
from collections import deque
from typing import Any

import gobnb

try:
    from curl_cffi import requests as cffi_requests
    from bs4 import BeautifulSoup

    HAS_FALLBACK = True
except ImportError:
    HAS_FALLBACK = False

# Cles possibles pour les donnees embarquees (Airbnb change parfois le nom)
EMBEDDED_DATA_KEYS = ("niobeClientData", "niobeMinimalClientData", "niobeFullClientData", "bootstrapData")
LD_LISTING_TYPES = {
    "lodgingbusiness",
    "house",
    "apartment",
    "residence",
    "touristattraction",
    "product",
    "hotel",
}
SUMMARY_ITEM_RE = re.compile(
    r"(?:\d+|studio)[^,;|\n]{0,40}(?:guest|voyageur|person|bedroom|chambre|bed|lit|bath|salle de bain)",
    re.IGNORECASE,
)
IMAGE_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
PRICE_NUMBER_RE = re.compile(r"(-?\d+(?:[.,]\d+)?)")
COUNT_TOKEN_RE = re.compile(r"(?P<count>\d+|un|une|one|a|an)\b", re.IGNORECASE)
ROOM_COUNT_PATTERNS = {
    "guest_capacity": (
        re.compile(r"(?P<count>\d+|un|une|one|a|an)\s+(?:guest|guests|voyageur|voyageurs|person|persons|people)", re.IGNORECASE),
    ),
    "bedrooms": (
        re.compile(r"(?P<count>\d+|un|une|one|a|an)\s+(?:bedroom|bedrooms|chambre|chambres)", re.IGNORECASE),
    ),
    "beds": (
        re.compile(r"(?P<count>\d+|un|une|one|a|an)\s+(?:bed|beds|lit|lits)\b", re.IGNORECASE),
    ),
    "bathrooms": (
        re.compile(r"(?P<count>\d+|un|une|one|a|an)\s+(?:bathroom|bathrooms|bath|baths|salle(?:s)? de bain(?:s)?)", re.IGNORECASE),
    ),
    "kitchens": (
        re.compile(r"(?P<count>\d+|un|une|one|a|an)\s+(?:kitchen|kitchens|cuisine|cuisines)\b", re.IGNORECASE),
    ),
}
DESCRIPTION_SECTION_SELECTORS = (
    "[data-section-id*='DESCRIPTION']",
    "[data-plugin-in-point-id*='DESCRIPTION']",
)
OVERVIEW_SECTION_SELECTORS = (
    "[data-section-id='OVERVIEW_DEFAULT_V2'] li",
    "[data-plugin-in-point-id='OVERVIEW_DEFAULT_V2'] li",
    "[data-section-id='OVERVIEW_DEFAULT'] li",
    "[data-plugin-in-point-id='OVERVIEW_DEFAULT'] li",
)
HIGHLIGHT_SECTION_SELECTORS = (
    "[data-section-id*='HIGHLIGHT']",
    "[data-plugin-in-point-id*='HIGHLIGHT']",
    "[data-section-id*='PREVIEW_AMENIT']",
    "[data-plugin-in-point-id*='PREVIEW_AMENIT']",
)
HIGHLIGHT_KEY_HINTS = ("highlight", "previewamenit", "preview_amenit", "listingexpectation", "primaryamenit")
GENERIC_DESCRIPTION_TITLES = {
    "description",
    "about this space",
    "about this place",
    "a propos de ce logement",
    "a propos du logement",
    "a propos de ce lieu",
}
SKIPPED_DESCRIPTION_LINES = {
    "show more",
    "show less",
    "afficher plus",
    "afficher moins",
    "voir plus",
    "voir moins",
}

# File d'attente globale pour sequencer les scrapes
REQUEST_QUEUE = deque()


def _safe_print(*args, **kwargs) -> None:
    """
    Évite qu'un log CLI fasse échouer l'API avec un Broken pipe
    quand stdout/stderr n'est plus disponible.
    """
    try:
        print(*args, **kwargs)
    except BrokenPipeError:
        return
    except OSError as e:
        if getattr(e, "errno", None) == errno.EPIPE:
            return
        raise


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value).strip()
    return re.sub(r"\s+", " ", str(value)).strip()


def _coerce_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if float(value) == float(value) else None
    if isinstance(value, str):
        normalized = value.strip().replace(",", ".")
        if not normalized:
            return None
        try:
            return float(normalized)
        except ValueError:
            return None
    return None


def _coerce_price(value: Any) -> int | None:
    number = _coerce_float(value)
    if number is None:
        if isinstance(value, str):
            match = PRICE_NUMBER_RE.search(value.replace("\xa0", " ").replace(" ", ""))
            if not match:
                return None
            number = _coerce_float(match.group(1))
        if number is None:
            return None
    if number <= 0:
        return None
    return int(round(number))


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


def _parse_count_token(raw_count: str) -> int | None:
    cleaned = _clean_text(raw_count).casefold()
    if not cleaned:
        return None
    if cleaned.isdigit():
        return int(cleaned)
    if cleaned in {"un", "une", "one", "a", "an"}:
        return 1
    return None


def _extract_room_counts_from_texts(values: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        text = _clean_text(value)
        if not text:
            continue
        for key, patterns in ROOM_COUNT_PATTERNS.items():
            for pattern in patterns:
                match = pattern.search(text)
                if not match:
                    continue
                parsed = _parse_count_token(match.group("count"))
                if parsed is None:
                    continue
                counts[key] = max(counts.get(key, 0), parsed)
                break
    return counts


def _merge_room_counts(*counts_list: dict[str, int]) -> dict[str, int]:
    merged: dict[str, int] = {}
    for counts in counts_list:
        for key, value in counts.items():
            if isinstance(value, int) and value > 0:
                merged[key] = max(merged.get(key, 0), value)
    return merged


def _sanitize_html_fragment(fragment: str, default_tag: str = "p") -> str:
    raw_fragment = fragment.strip()
    if not raw_fragment:
        return ""

    if not HAS_FALLBACK:
        text = html.escape(_clean_text(raw_fragment))
        return f"<{default_tag}>{text}</{default_tag}>" if text else ""

    parsed = BeautifulSoup(raw_fragment, "html.parser")
    allowed_tags = {"p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "h2", "h3"}

    for tag in parsed.find_all(True):
        if tag.name not in allowed_tags:
            tag.unwrap()
            continue
        tag.attrs = {}

    rendered = "".join(str(node) for node in parsed.contents).strip()
    if not rendered:
        text = html.escape(_clean_text(parsed.get_text(" ", strip=True)))
        return f"<{default_tag}>{text}</{default_tag}>" if text else ""

    if re.match(r"^<\s*(?:p|h2|h3|ul|ol|li)\b", rendered, re.IGNORECASE):
        return rendered
    return f"<{default_tag}>{rendered}</{default_tag}>"


def _extract_overview_items_from_soup(soup: "BeautifulSoup | None") -> list[str]:
    if soup is None:
        return []
    items: list[str] = []
    for selector in OVERVIEW_SECTION_SELECTORS:
        for node in soup.select(selector):
            text = _clean_text(node.get_text(" ", strip=True))
            if text:
                items.append(text)
    return _dedupe_texts(items)


def _extract_description_sections_from_soup(soup: "BeautifulSoup | None") -> list[dict[str, str]]:
    if soup is None:
        return []

    sections: list[dict[str, str]] = []
    seen: set[str] = set()
    containers = []
    for selector in DESCRIPTION_SECTION_SELECTORS:
        containers.extend(soup.select(selector))

    for container in containers:
        container_title = ""
        first_heading = container.find(["h2", "h3"])
        if first_heading:
            raw_title = _clean_text(first_heading.get_text(" ", strip=True))
            if raw_title.casefold() not in GENERIC_DESCRIPTION_TITLES:
                container_title = raw_title

        current_title = container_title
        current_parts: list[str] = []
        for node in container.find_all(["h3", "h4", "p", "li"], recursive=True):
            text = _clean_text(node.get_text(" ", strip=True))
            if not text:
                continue
            if text.casefold() in SKIPPED_DESCRIPTION_LINES:
                continue

            if node.name in {"h3", "h4"}:
                if current_parts:
                    content = "".join(current_parts).strip()
                    key = f"{current_title.casefold()}::{_clean_text(content).casefold()}"
                    if content and key not in seen:
                        seen.add(key)
                        sections.append({"title": current_title, "content": content})
                current_title = text
                current_parts = []
                continue

            sanitized = _sanitize_html_fragment(str(node), default_tag="li" if node.name == "li" else "p")
            if sanitized:
                current_parts.append(sanitized)

        if current_parts:
            content = "".join(current_parts).strip()
            key = f"{current_title.casefold()}::{_clean_text(content).casefold()}"
            if content and key not in seen:
                seen.add(key)
                sections.append({"title": current_title, "content": content})

    return sections


def _render_description_html(sections: list[dict[str, str]], fallback_text: str) -> str:
    parts: list[str] = []
    for section in sections:
        title = _clean_text(section.get("title"))
        content = (section.get("content") or "").strip()
        if not content:
            continue
        if title:
            parts.append(f"<h2>{html.escape(title)}</h2>")
        parts.append(content)

    rendered = "".join(parts).strip()
    if rendered:
        return rendered

    clean_fallback = fallback_text.strip()
    if not clean_fallback:
        return ""
    if "<" in clean_fallback and ">" in clean_fallback:
        return _sanitize_html_fragment(clean_fallback, default_tag="p")
    return _sanitize_html_fragment(html.escape(_clean_text(clean_fallback)), default_tag="p")


def _extract_highlight_titles_from_value(value: Any, active: bool = False) -> list[str]:
    titles: list[str] = []
    if isinstance(value, dict):
        if active:
            title = _clean_text(value.get("title") or value.get("name") or value.get("label"))
            subtitle = _clean_text(value.get("subtitle") or value.get("description"))
            if title and len(title) <= 80:
                titles.append(title)
            if subtitle and len(subtitle) <= 80:
                titles.append(subtitle)
        for key, child in value.items():
            key_name = _clean_text(key).lower()
            child_active = active or any(hint in key_name for hint in HIGHLIGHT_KEY_HINTS)
            titles.extend(_extract_highlight_titles_from_value(child, child_active))
    elif isinstance(value, list):
        for child in value:
            titles.extend(_extract_highlight_titles_from_value(child, active))
    elif active and isinstance(value, str):
        text = _clean_text(value)
        if text and len(text) <= 80:
            titles.append(text)
    return titles


def _extract_highlight_titles(*roots: Any, soup: "BeautifulSoup | None" = None) -> list[str]:
    titles: list[str] = []
    for root in roots:
        titles.extend(_extract_highlight_titles_from_value(root))

    if soup is not None:
        for selector in HIGHLIGHT_SECTION_SELECTORS:
            for container in soup.select(selector):
                for node in container.find_all(["h2", "h3", "p", "li", "span"], recursive=True):
                    text = _clean_text(node.get_text(" ", strip=True))
                    if text and len(text) <= 80 and text.casefold() not in SKIPPED_DESCRIPTION_LINES:
                        titles.append(text)

    filtered = []
    for title in _dedupe_texts(titles):
        normalized = title.casefold()
        if normalized in GENERIC_DESCRIPTION_TITLES:
            continue
        if COUNT_TOKEN_RE.fullmatch(normalized):
            continue
        filtered.append(title)
    return filtered


def _normalize_image_entries(values: list[str]) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for idx, url in enumerate(values, start=1):
        clean = _clean_text(url)
        if not clean or clean in seen or not IMAGE_URL_RE.match(clean):
            continue
        seen.add(clean)
        out.append({"title": f"Photo {idx}", "url": clean})
    return out


def _extract_embedded_payload(data: dict) -> tuple[Any, Any]:
    embedded_data = None
    raw_deferred = None
    for tag_data in _walk(data):
        if not isinstance(tag_data, dict):
            continue
        for key in EMBEDDED_DATA_KEYS:
            entries = tag_data.get(key)
            if not isinstance(entries, list) or not entries:
                continue
            entry = entries[0]
            if isinstance(entry, (list, tuple)) and len(entry) > 1:
                embedded_data = entry[1]
            else:
                embedded_data = entry
            return embedded_data, raw_deferred
        if raw_deferred is None and tag_data:
            raw_deferred = tag_data
    return embedded_data, raw_deferred


def _flatten_ld_nodes(value: Any) -> list[dict]:
    nodes: list[dict] = []
    if isinstance(value, dict):
        if isinstance(value.get("@graph"), list):
            for item in value["@graph"]:
                nodes.extend(_flatten_ld_nodes(item))
        nodes.append(value)
    elif isinstance(value, list):
        for item in value:
            nodes.extend(_flatten_ld_nodes(item))
    return nodes


def _extract_ld_nodes(soup: "BeautifulSoup") -> list[dict]:
    nodes: list[dict] = []
    for script in soup.select("script[type='application/ld+json']"):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        nodes.extend(_flatten_ld_nodes(payload))
    return nodes


def _pick_listing_ld_node(nodes: list[dict]) -> dict:
    best: dict = {}
    best_score = -1
    for node in nodes:
        if not isinstance(node, dict):
            continue
        raw_type = node.get("@type")
        types = raw_type if isinstance(raw_type, list) else [raw_type]
        normalized_types = {_clean_text(item).lower() for item in types if item}
        score = 0
        if normalized_types & LD_LISTING_TYPES:
            score += 5
        if node.get("name"):
            score += 2
        if node.get("image"):
            score += 2
        if node.get("address"):
            score += 2
        if node.get("geo"):
            score += 1
        if score > best_score:
            best = node
            best_score = score
    return best


def _extract_meta_content(soup: "BeautifulSoup", *selectors: tuple[str, str]) -> str:
    for attr, value in selectors:
        tag = soup.find("meta", attrs={attr: value})
        if tag and tag.get("content"):
            return _clean_text(tag["content"])
    return ""


def _extract_location_from_address(address: Any) -> dict:
    if not isinstance(address, dict):
        return {}
    city = _clean_text(
        address.get("addressLocality")
        or address.get("city")
        or address.get("locality")
        or address.get("cityName")
    )
    region = _clean_text(
        address.get("addressRegion")
        or address.get("region")
        or address.get("state")
        or address.get("province")
    )
    country = _clean_text(address.get("addressCountry") or address.get("country"))
    street = _clean_text(
        address.get("streetAddress")
        or address.get("addressLine1")
        or address.get("line1")
        or address.get("formattedStreetAddress")
    )
    parts = [part for part in (street, city, region, country) if part]
    return {
        "precise_address": ", ".join(parts) if parts else "",
        "city": city,
        "region": region,
        "country": country,
    }


def _extract_coordinates_from_value(value: Any) -> tuple[float | None, float | None]:
    if isinstance(value, dict):
        latitude = _coerce_float(
            value.get("latitude")
            or value.get("lat")
            or value.get("centerLat")
        )
        longitude = _coerce_float(
            value.get("longitude")
            or value.get("lng")
            or value.get("lon")
            or value.get("centerLng")
        )
        if latitude is not None and longitude is not None:
            return latitude, longitude
    return None, None


def _extract_coordinates(*roots: Any) -> tuple[float | None, float | None]:
    for root in roots:
        for node in _walk(root):
            latitude, longitude = _extract_coordinates_from_value(node)
            if latitude is not None and longitude is not None:
                return latitude, longitude
    return None, None


def _extract_images_from_value(value: Any) -> list[dict]:
    urls: list[str] = []
    if isinstance(value, str):
        clean = _clean_text(value)
        if IMAGE_URL_RE.match(clean) and any(token in clean.lower() for token in ("jpg", "jpeg", "png", "webp", "picture", "image", "photo", "muscache")):
            urls.append(clean)
    elif isinstance(value, dict):
        for key, child in value.items():
            key_name = _clean_text(key).lower()
            if key_name in {"url", "image", "src", "picture", "pictureurl", "thumbnailurl"}:
                urls.extend(item["url"] for item in _extract_images_from_value(child))
            elif any(token in key_name for token in ("image", "photo", "picture", "gallery")):
                urls.extend(item["url"] for item in _extract_images_from_value(child))
    elif isinstance(value, list):
        for child in value:
            urls.extend(item["url"] for item in _extract_images_from_value(child))
    return _normalize_image_entries(urls)


def _extract_amenities_from_value(value: Any, default_title: str = "Equipements") -> list[dict]:
    groups: list[dict] = []
    if isinstance(value, dict):
        possible_list = value.get("values") or value.get("items") or value.get("amenities")
        if isinstance(possible_list, list):
            entries = []
            for item in possible_list:
                if not isinstance(item, dict):
                    continue
                title = _clean_text(item.get("title") or item.get("name") or item.get("label"))
                if not title:
                    continue
                subtitle = _clean_text(item.get("subtitle") or item.get("description"))
                available = item.get("available")
                entry = {"title": title}
                if subtitle:
                    entry["subtitle"] = subtitle
                if isinstance(available, bool):
                    entry["available"] = available
                entries.append(entry)
            if entries:
                group_title = _clean_text(value.get("title") or value.get("name") or default_title) or default_title
                groups.append({"title": group_title, "values": entries})
        for key, child in value.items():
            key_name = _clean_text(key).lower()
            if "amenit" in key_name:
                groups.extend(_extract_amenities_from_value(child, default_title))
    elif isinstance(value, list):
        flat_entries = []
        nested_groups = []
        for child in value:
            if isinstance(child, dict) and any(k in child for k in ("title", "name", "label")) and not any(k in child for k in ("values", "items", "amenities")):
                title = _clean_text(child.get("title") or child.get("name") or child.get("label"))
                if title:
                    entry = {"title": title}
                    subtitle = _clean_text(child.get("subtitle") or child.get("description"))
                    available = child.get("available")
                    if subtitle:
                        entry["subtitle"] = subtitle
                    if isinstance(available, bool):
                        entry["available"] = available
                    flat_entries.append(entry)
            nested_groups.extend(_extract_amenities_from_value(child, default_title))
        if flat_entries:
            nested_groups.insert(0, {"title": default_title, "values": flat_entries})
        groups.extend(nested_groups)
    deduped_groups: list[dict] = []
    seen: set[str] = set()
    for group in groups:
        title = _clean_text(group.get("title") or default_title) or default_title
        values = []
        for item in group.get("values", []):
            item_title = _clean_text(item.get("title"))
            if not item_title:
                continue
            key = f"{title.casefold()}::{item_title.casefold()}"
            if key in seen:
                continue
            seen.add(key)
            normalized_item = {"title": item_title}
            subtitle = _clean_text(item.get("subtitle"))
            if subtitle:
                normalized_item["subtitle"] = subtitle
            if isinstance(item.get("available"), bool):
                normalized_item["available"] = item["available"]
            values.append(normalized_item)
        if values:
            deduped_groups.append({"title": title, "values": values})
    return deduped_groups


def _extract_summary_items(*roots: Any) -> list[str]:
    matches: list[str] = []
    for root in roots:
        for node in _walk(root):
            if not isinstance(node, str):
                continue
            text = _clean_text(node)
            if not text or len(text) > 80:
                continue
            if SUMMARY_ITEM_RE.search(text):
                matches.append(text)
    return _dedupe_texts(matches)


def _extract_house_rules(*roots: Any) -> dict:
    check_in_values: list[str] = []
    check_out_values: list[str] = []
    for root in roots:
        for node in _walk(root):
            if isinstance(node, dict):
                for key, value in node.items():
                    key_name = _clean_text(key).lower()
                    text = _clean_text(value)
                    if not text:
                        continue
                    if "checkin" in key_name or "check_in" in key_name:
                        check_in_values.append(text)
                    elif "checkout" in key_name or "check_out" in key_name:
                        check_out_values.append(text)
            elif isinstance(node, str):
                text = _clean_text(node)
                if "check-in" in text.lower() or "check in" in text.lower() or "arriv" in text.lower():
                    check_in_values.append(text)
                if "check-out" in text.lower() or "check out" in text.lower() or "depart" in text.lower():
                    check_out_values.append(text)
    general = []
    deduped_check_in = _dedupe_texts(check_in_values)
    deduped_check_out = _dedupe_texts(check_out_values)
    if deduped_check_in:
        general.append({"title": "Arrivee", "values": [{"title": deduped_check_in[0]}]})
    if deduped_check_out:
        general.append({"title": "Depart", "values": [{"title": deduped_check_out[0]}]})
    return {"general": general} if general else {}


def _extract_price(*roots: Any) -> int | None:
    preferred_key_fragments = ("night", "nightly", "avg", "rate", "price", "amount")
    for root in roots:
        if isinstance(root, dict):
            top_price = _coerce_price(root.get("price"))
            if top_price is not None:
                return top_price
        for node in _walk(root):
            if not isinstance(node, dict):
                continue
            keys = {_clean_text(key).lower() for key in node.keys()}
            if "price" in keys and ("pricecurrency" in keys or "currency" in keys or "formattedprice" in keys):
                parsed = _coerce_price(node.get("price"))
                if parsed is not None:
                    return parsed
            for key, value in node.items():
                key_name = _clean_text(key).lower()
                if not any(fragment in key_name for fragment in preferred_key_fragments):
                    continue
                parsed = _coerce_price(value)
                if parsed is not None:
                    return parsed
    return None


def _first_non_empty(*values: Any) -> str:
    for value in values:
        clean = _clean_text(value)
        if clean:
            return clean
    return ""


def _normalize_scraped_data(
    raw_data: Any,
    *,
    url: str,
    source: str,
    soup: "BeautifulSoup | None" = None,
    embedded_data: Any = None,
    raw_deferred: Any = None,
) -> dict:
    result = dict(raw_data) if isinstance(raw_data, dict) else {"raw": raw_data}
    result["listing_url"] = url
    result["source"] = source
    if embedded_data is not None and "embedded_data" not in result:
        result["embedded_data"] = embedded_data
    if raw_deferred is not None and "raw_deferred" not in result:
        result["raw_deferred"] = raw_deferred

    roots = [result]
    if embedded_data is not None:
        roots.append(embedded_data)
    if raw_deferred is not None:
        roots.append(raw_deferred)

    ld_listing: dict = {}
    meta_title = ""
    meta_description = ""
    meta_image = ""
    if soup is not None:
        ld_nodes = _extract_ld_nodes(soup)
        ld_listing = _pick_listing_ld_node(ld_nodes)
        roots.append(ld_listing)
        meta_title = _extract_meta_content(soup, ("property", "og:title"), ("name", "twitter:title"))
        meta_description = _extract_meta_content(soup, ("name", "description"), ("property", "og:description"))
        meta_image = _extract_meta_content(soup, ("property", "og:image"), ("name", "twitter:image"))

    location = {}
    for candidate in (
        result.get("address"),
        result.get("location"),
        ld_listing.get("address"),
    ):
        extracted = _extract_location_from_address(candidate)
        if any(extracted.values()):
            location = extracted
            break

    if not location:
        for node in roots:
            for value in _walk(node):
                extracted = _extract_location_from_address(value)
                if any(extracted.values()):
                    location = extracted
                    break
            if location:
                break

    latitude, longitude = _extract_coordinates(*roots, ld_listing.get("geo"))
    images = result.get("images")
    if not isinstance(images, list) or not images:
        image_urls = []
        if meta_image:
            image_urls.append(meta_image)
        for root in roots:
            image_urls.extend(item["url"] for item in _extract_images_from_value(root))
        images = _normalize_image_entries(image_urls)

    amenities = result.get("amenities")
    if not isinstance(amenities, list) or not amenities:
        for root in roots:
            extracted = _extract_amenities_from_value(root)
            if extracted:
                amenities = extracted
                break
        if not isinstance(amenities, list):
            amenities = []

    summary_items = _extract_summary_items(*roots)
    overview_items = _extract_overview_items_from_soup(soup)
    room_counts = _merge_room_counts(
        _extract_room_counts_from_texts(summary_items),
        _extract_room_counts_from_texts(overview_items),
    )
    room_type = _first_non_empty(result.get("room_type"), ld_listing.get("@type"))
    if room_type and room_type.lower() in {"lodgingbusiness", "product", "house", "apartment", "hotel"}:
        room_type = "Logement entier"
    person_capacity = result.get("person_capacity")
    if person_capacity is None:
        for item in summary_items:
            lowered = item.lower()
            if any(token in lowered for token in ("guest", "voyageur", "person")):
                match = re.search(r"\d+", lowered)
                if match:
                    person_capacity = int(match.group(0))
                    break

    house_rules = result.get("house_rules")
    if not isinstance(house_rules, dict) or not house_rules.get("general"):
        house_rules = _extract_house_rules(*roots)

    title = _first_non_empty(result.get("title"), ld_listing.get("name"), meta_title)
    description_preview = _first_non_empty(result.get("description"), ld_listing.get("description"), meta_description)
    description_sections = _extract_description_sections_from_soup(soup)
    description = _render_description_html(description_sections, description_preview)
    precise_address = _first_non_empty(result.get("precise_address"), location.get("precise_address"))
    city = _first_non_empty(result.get("city"), location.get("city"))
    region = _first_non_empty(result.get("region"), location.get("region"))
    country = _first_non_empty(result.get("country"), location.get("country"), "France")
    price = _coerce_price(result.get("price"))
    if price is None:
        price = _extract_price(*roots, ld_listing.get("offers"))

    location_title_parts = [part for part in (city, region, country) if part]
    location_title = ", ".join(location_title_parts)
    sub_description = result.get("sub_description")
    if not isinstance(sub_description, dict):
        sub_description = {}
    if location_title and not _clean_text(sub_description.get("title")):
        if room_type:
            sub_description["title"] = f"{room_type} - {location_title}"
        else:
            sub_description["title"] = location_title
    overview_or_summary_items = overview_items or summary_items
    if overview_or_summary_items:
        sub_description["items"] = overview_or_summary_items

    location_descriptions = result.get("location_descriptions")
    if (not isinstance(location_descriptions, list) or not location_descriptions) and location_title:
        location_descriptions = [{"title": location_title, "content": precise_address or location_title}]

    highlight_titles = _extract_highlight_titles(*roots, soup=soup)

    normalized = {
        **result,
        "listing_url": url,
        "source": source,
        "title": title,
        "description": description,
        "coordinates": {"latitude": latitude, "longitude": longitude} if latitude is not None and longitude is not None else {},
        "person_capacity": person_capacity if isinstance(person_capacity, int) and person_capacity > 0 else result.get("person_capacity"),
        "room_type": room_type or result.get("room_type") or "Logement entier",
        "amenities": amenities,
        "images": images,
        "house_rules": house_rules,
        "sub_description": sub_description,
        "overview_items": overview_or_summary_items,
        "room_counts": room_counts,
        "highlight_titles": highlight_titles,
        "location_descriptions": location_descriptions,
        "precise_address": precise_address,
        "city": city,
        "region": region,
        "country": country,
    }
    if price is not None:
        normalized["price"] = price
    return normalized


def add_request(client_id: str, url: str) -> None:
    """Ajoute une demande de scraping a la file d'attente."""
    REQUEST_QUEUE.append((client_id, url))


def process_queue(
    currency: str,
    check_in: str,
    check_out: str,
    proxy_url: str,
    output_template: str,
    min_delay: float,
    max_delay: float,
) -> None:
    """Traite la file d'attente sequentiellement en espaçant les requetes."""
    while REQUEST_QUEUE:
        client_id, url = REQUEST_QUEUE.popleft()
        _safe_print(f"Traitement de {url} pour le client {client_id}...")

        try:
            data = scrape_listing(
                url,
                currency=currency,
                check_in=check_in,
                check_out=check_out,
                proxy_url=proxy_url,
            )
        except Exception as e:  # pragma: no cover - robustesse CLI
            _safe_print(f"Erreur lors du scraping de {url} pour {client_id}: {e}", file=sys.stderr)
            continue

        output_path = output_template.format(client_id=client_id)
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except OSError as e:  # pragma: no cover
            _safe_print(f"Impossible d'ecrire dans {output_path}: {e}", file=sys.stderr)
            continue

        _safe_print(f"Donnees enregistrees dans {output_path}")

        delay = random.uniform(min_delay, max_delay)
        _safe_print(f"Attente de {delay:.1f} s avant la prochaine annonce...")
        time.sleep(delay)


def _fetch_page_fallback(url: str, proxy_url: str) -> dict:
    """Recupere la page, extrait les donnees HTML/JSON-LD et normalise le resultat."""
    soup, embedded_data, raw_deferred = _fetch_page_context(url, proxy_url)

    base = {"listing_url": url, "source": "fallback_embedded_json"}
    if embedded_data is not None:
        base["embedded_data"] = embedded_data
    if raw_deferred is not None:
        base["raw_deferred"] = raw_deferred
    if embedded_data is None and raw_deferred is None:
        base["error"] = "Aucun JSON differe trouve dans la page."

    return _normalize_scraped_data(
        base,
        url=url,
        source="fallback_embedded_json",
        soup=soup,
        embedded_data=embedded_data,
        raw_deferred=raw_deferred,
    )


def _fetch_page_context(url: str, proxy_url: str) -> tuple["BeautifulSoup", Any, Any]:
    """Recupere le HTML de la page et les donnees JSON embarquees si disponibles."""
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    proxies = {}
    if proxy_url:
        proxies = {"http": proxy_url, "https": proxy_url}
    resp = cffi_requests.get(url, headers=headers, proxies=proxies, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    embedded_data = None
    raw_deferred = None
    for tag in soup.select("[id^='data-deferred-state-']"):
        raw = tag.get_text(strip=True).replace("\n", " ")
        raw = re.sub(r"\s+", " ", raw)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        embedded_data, raw_deferred = _extract_embedded_payload(data)
        if embedded_data is not None or raw_deferred is not None:
            break
        if raw_deferred is None:
            raw_deferred = data
    return soup, embedded_data, raw_deferred


def scrape_listing(
    url: str,
    currency: str = "EUR",
    check_in: str = "",
    check_out: str = "",
    proxy_url: str = "",
) -> dict:
    """
    Scrape une annonce Airbnb par URL et retourne un format normalise.
    Si check_in/check_out sont fournis, les prix pour ces dates sont inclus.
    En cas d'echec du parsing gobnb, tente un fallback HTML/JSON-LD.
    """
    url = url.strip()
    if not url.startswith("http"):
        # Lien mobile sans protocole (ex. airbnb.fr/rooms/123?unique_share_id=...)
        m = re.match(
            r"(?i)(?:www\.)?(airbnb\.(?:fr|com|co\.uk|es|de|it))/rooms/(\d+)",
            url,
        )
        if m:
            url = f"https://www.{m.group(1)}/rooms/{m.group(2)}"
        else:
            # ID seul (chiffres)
            url = f"https://www.airbnb.com/rooms/{url}"

    try:
        data = gobnb.Get_from_room_url(url, currency, check_in, check_out, proxy_url or "")
    except (KeyError, TypeError, IndexError) as e:
        if HAS_FALLBACK:
            _safe_print(f"gobnb a echoue ({e}), tentative de recuperation fallback...", file=sys.stderr)
            return _fetch_page_fallback(url, proxy_url or "")
        raise

    if not isinstance(data, dict):
        data = {"raw": data}

    if HAS_FALLBACK:
        try:
            soup, embedded_data, raw_deferred = _fetch_page_context(url, proxy_url or "")
            return _normalize_scraped_data(
                data,
                url=url,
                source="gobnb",
                soup=soup,
                embedded_data=embedded_data,
                raw_deferred=raw_deferred,
            )
        except Exception as e:  # pragma: no cover - enrichissement best effort
            _safe_print(f"Enrichissement HTML Airbnb indisponible: {e}", file=sys.stderr)

    return _normalize_scraped_data(data, url=url, source="gobnb")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scraper une annonce Airbnb (gobnb) et enregistrer les données en JSON."
    )
    parser.add_argument(
        "url",
        nargs="?",
        help="URL de l'annonce (ex. https://www.airbnb.com/rooms/123456) ou room_id.",
    )
    parser.add_argument(
        "--currency",
        "-c",
        default="EUR",
        help="Code devise (défaut: EUR).",
    )
    parser.add_argument(
        "--check-in",
        default="",
        help="Date check-in (YYYY-MM-DD) pour inclure les prix.",
    )
    parser.add_argument(
        "--check-out",
        default="",
        help="Date check-out (YYYY-MM-DD) pour inclure les prix.",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="annonce.json",
        help="Fichier JSON de sortie (défaut: annonce.json).",
    )
    parser.add_argument(
        "--proxy",
        "-p",
        default="",
        help="URL proxy (optionnel), ex. http://user:pass@host:port.",
    )
    parser.add_argument(
        "--batch-file",
        "-b",
        default="",
        help="Fichier texte contenant une URL (ou un ID) par ligne pour un scraping séquentiel.",
    )
    parser.add_argument(
        "--min-delay",
        type=float,
        default=5.0,
        help="Délai minimum entre deux scrapes (secondes, défaut: 5).",
    )
    parser.add_argument(
        "--max-delay",
        type=float,
        default=15.0,
        help="Délai maximum entre deux scrapes (secondes, défaut: 15).",
    )
    parser.add_argument(
        "--output-template",
        default="annonce_{client_id}.json",
        help="Modèle de nom de fichier pour le mode batch (défaut: annonce_{client_id}.json).",
    )

    args = parser.parse_args()

    # Validation basique des délais
    if args.min_delay < 0 or args.max_delay < 0:
        _safe_print("Les délais min/max doivent être positifs.", file=sys.stderr)
        sys.exit(1)
    if args.min_delay > args.max_delay:
        # On échange pour éviter une configuration invalide
        args.min_delay, args.max_delay = args.max_delay, args.min_delay

    # Mode batch : on lit un fichier contenant une URL/ID par ligne
    if args.batch_file:
        try:
            with open(args.batch_file, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
        except OSError as e:
            _safe_print(f"Impossible de lire le fichier batch {args.batch_file}: {e}", file=sys.stderr)
            sys.exit(1)

        if not lines:
            _safe_print("Le fichier batch ne contient aucune URL/ID.", file=sys.stderr)
            sys.exit(1)

        for idx, line in enumerate(lines, start=1):
            client_id = f"client_{idx}"
            add_request(client_id, line)

        process_queue(
            currency=args.currency,
            check_in=args.check_in,
            check_out=args.check_out,
            proxy_url=args.proxy,
            output_template=args.output_template,
            min_delay=args.min_delay,
            max_delay=args.max_delay,
        )
        return

    # Mode simple : une seule URL, comme avant
    url = args.url

    # Mode interactif : si aucune URL n'est passée en argument, on la demande à l'utilisateur.
    if not url:
        try:
            url = input("Entrez l'URL de l'annonce Airbnb (ou l'ID de l'annonce) : ").strip()
        except KeyboardInterrupt:
            _safe_print("\nAnnulé par l'utilisateur.")
            sys.exit(1)
        if not url:
            _safe_print("Aucune URL fournie, arrêt.", file=sys.stderr)
            sys.exit(1)

    try:
        data = scrape_listing(
            url,
            currency=args.currency,
            check_in=args.check_in,
            check_out=args.check_out,
            proxy_url=args.proxy,
        )
    except (KeyError, TypeError) as e:
        _safe_print(
            f"Erreur de parsing (Airbnb a peut-être changé sa page) : {e}\n"
            "→ Mettre à jour gobnb : pip install -U gobnb\n"
            "→ Voir https://github.com/johnbalvin/pybnb / https://github.com/johnbalvin/pyairbnb",
            file=sys.stderr,
        )
        sys.exit(1)
    except Exception as e:
        _safe_print(f"Erreur lors du scraping: {e}", file=sys.stderr)
        sys.exit(1)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    _safe_print(f"Données enregistrées dans {args.output}")


if __name__ == "__main__":
    main()
