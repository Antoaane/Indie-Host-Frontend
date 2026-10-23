"""
Scraper Airbnb base sur gobnb (https://github.com/johnbalvin/pybnb).
Retourne un format normalise pour l'import frontend, meme en fallback.
"""
import argparse
import html
import json
import os
import random
import re
import sys
import time
import errno
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from collections import deque
from typing import Any

PLAYWRIGHT_TIMEOUT_SECONDS = 35

import gobnb

from airbnb_amenity_mapping import translate_amenities_to_indiehost

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "0")

try:
    from curl_cffi import requests as cffi_requests
    from bs4 import BeautifulSoup

    HAS_FALLBACK = True
except ImportError:
    HAS_FALLBACK = False

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
    "[data-section-id='DESCRIPTION_MODAL']",
    "[data-plugin-in-point-id='DESCRIPTION_MODAL']",
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
SKIPPED_DESCRIPTION_SECTION_TITLES = {
    "détails de l'enregistrement",
    "details de l'enregistrement",
}
SKIPPED_DESCRIPTION_SECTION_PATTERNS = (
    re.compile(r"ce qu(?:['’]| i)l faut savoir sur les logements proposés par des (?:particuliers|entreprises)", re.IGNORECASE),
)
DESCRIPTION_EXPAND_LABELS = (
    "show more about this place",
    "show more",
    "lire la suite",
    "afficher plus",
    "voir plus",
)
AMENITY_SECTION_SELECTORS = (
    "[data-cursor-amenities-modal]",
    "[data-section-id*='AMENIT']",
    "[data-plugin-in-point-id*='AMENIT']",
    "[data-testid*='amenit']",
)
GENERIC_AMENITY_TITLES = {
    "ce que propose ce logement",
    "ce que cet endroit propose",
    "what this place offers",
    "amenities",
    "equipements",
    "équipements",
}
SKIPPED_AMENITY_LINES = {
    "show more",
    "show less",
    "show all",
    "afficher plus",
    "afficher moins",
    "voir plus",
    "voir moins",
}
AMENITY_VALUE_SKIP_PATTERNS = (
    re.compile(r"^(?:available|disponible|included|inclu)\b", re.IGNORECASE),
    re.compile(r"^(?:not available|non disponible)\b", re.IGNORECASE),
    re.compile(r"^(?:show all|show more|afficher|voir plus)\b", re.IGNORECASE),
)
AMENITY_EXPAND_LABELS = (
    "show all amenities",
    "what this place offers",
    "amenities",
    "afficher les",
    "équipements",
    "equipements",
)

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
        # Certains lancements via uvicorn/reload ou terminaux détachés
        # remontent EIO au lieu de EPIPE quand stderr/stdout n'est pas exploitable.
        if getattr(e, "errno", None) in {errno.EPIPE, errno.EIO}:
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


def _coerce_rating(value: Any) -> float | None:
    number = _coerce_float(value)
    if number is None:
        return None
    if number < 0 or number > 5:
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


def _soup_has_description_expand_button(soup: "BeautifulSoup | None") -> bool:
    if soup is None:
        return False
    for button in soup.find_all("button"):
        label = _clean_text(button.get("aria-label"))
        text = _clean_text(button.get_text(" ", strip=True))
        haystack = f"{label} {text}".casefold()
        if any(token in haystack for token in DESCRIPTION_EXPAND_LABELS):
            return True
    return False


def _soup_has_amenities_expand_button(soup: "BeautifulSoup | None") -> bool:
    if soup is None:
        return False
    for button in soup.find_all("button"):
        label = _clean_text(button.get("aria-label"))
        text = _clean_text(button.get_text(" ", strip=True))
        haystack = f"{label} {text}".casefold()
        if any(token in haystack for token in AMENITY_EXPAND_LABELS):
            return True
    return False


def _extract_amenities_expand_count_from_soup(soup: "BeautifulSoup | None") -> int | None:
    if soup is None:
        return None
    for button in soup.find_all("button"):
        label = _clean_text(button.get("aria-label"))
        text = _clean_text(button.get_text(" ", strip=True))
        haystack = f"{label} {text}".casefold()
        if not any(token in haystack for token in AMENITY_EXPAND_LABELS):
            continue
        match = re.search(r"\b(\d{1,3})\b", haystack)
        if match:
            return int(match.group(1))
    return None


def _sanitize_description_modal_html(fragment: str) -> str:
    if not fragment:
        return ""
    if not HAS_FALLBACK:
        return _sanitize_html_fragment(fragment)

    parsed = BeautifulSoup(fragment, "html.parser")

    for tag in parsed.find_all(True):
        classes = set(tag.get("class") or [])
        style = _clean_text(tag.get("style"))

        if tag.name == "span" and "_g5uevq" in classes:
            tag.name = "h2"
            tag.attrs = {}
            continue

        if tag.name == "span" and "font-style: italic" in style.lower():
            tag.name = "em"
            tag.attrs = {}
            continue

        if tag.name == "span" and ("font-weight" in style.lower() or "bold" in style.lower()):
            tag.name = "strong"
            tag.attrs = {}
            continue

        if tag.name == "b":
            tag.name = "strong"
            tag.attrs = {}
            continue

        if tag.name == "i":
            tag.name = "em"
            tag.attrs = {}
            continue

        if tag.name in {"div", "section"}:
            tag.unwrap()
            continue

        if tag.name == "span":
            tag.unwrap()
            continue

        if tag.name not in {"br", "strong", "em", "h2", "h3", "p", "ul", "ol", "li"}:
            tag.unwrap()
            continue

        tag.attrs = {}

    rendered = "".join(str(node) for node in parsed.contents)
    rendered = re.sub(r"(?:<br\s*/?>\s*){3,}", "<br><br>", rendered, flags=re.IGNORECASE)
    rendered = re.sub(r"\s*<h2>", "<h2>", rendered)
    rendered = re.sub(r"</h2>\s*", "</h2>", rendered)
    return rendered.strip()


def _extract_description_from_modal(soup: "BeautifulSoup | None") -> list[dict[str, str]]:
    if soup is None:
        return []

    for selector in (
        "[data-cursor-description-modal]",
        "[data-section-id='DESCRIPTION_MODAL']",
        "[data-plugin-in-point-id='DESCRIPTION_MODAL']",
    ):
        container = soup.select_one(selector)
        if container is None:
            continue

        content_root = (
            container.select_one(".cz692az .l1h825yc")
            or container.select_one(".cz692az")
            or container.select_one("span")
            or container
        )
        content_html = _sanitize_description_modal_html(content_root.decode_contents())
        if content_html:
            return [{"title": "", "content": content_html}]

    return []


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

    modal_sections = _extract_description_from_modal(soup)
    if modal_sections:
        return modal_sections

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


def _description_sections_to_text(sections: list[dict[str, str]]) -> str:
    text_parts: list[str] = []
    for section in sections:
        title = _clean_text(section.get("title"))
        content = section.get("content") or ""
        if title:
            text_parts.append(title)
        if HAS_FALLBACK:
            text_parts.append(_clean_text(BeautifulSoup(content, "html.parser").get_text(" ", strip=True)))
        else:
            text_parts.append(_clean_text(re.sub(r"<[^>]+>", " ", content)))
    return " ".join(part for part in text_parts if part).strip()


def _should_skip_description_section(section: dict[str, str]) -> bool:
    title = _clean_text(section.get("title")).casefold()
    content = _clean_text(section.get("content"))

    if title in SKIPPED_DESCRIPTION_SECTION_TITLES:
        return True
    if any(pattern.search(title) for pattern in SKIPPED_DESCRIPTION_SECTION_PATTERNS):
        return True

    lowered_content = content.casefold()
    if "centre d'aide" in lowered_content and "pour plus d'informations juridiques" in lowered_content:
        return True
    if "utilisez toujours airbnb pour envoyer de l'argent" in lowered_content:
        return True

    return False


def _extract_description_sections_from_value(*roots: Any) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    seen: set[str] = set()

    def append_section(title: str, content: str) -> None:
        clean_title = _clean_text(title)
        clean_content = (content or "").strip()
        if not clean_content:
            return
        content_text = _description_sections_to_text([{"title": clean_title, "content": clean_content}]).casefold()
        key = f"{clean_title.casefold()}::{content_text}"
        if not content_text or key in seen:
            return
        seen.add(key)
        sections.append({"title": clean_title, "content": clean_content})

    for root in roots:
        for node in _walk(root):
            if not isinstance(node, dict):
                continue

            identifier = " ".join(
                filter(
                    None,
                    (
                        _clean_text(node.get("sectionId")),
                        _clean_text(node.get("pluginPointId")),
                        _clean_text(node.get("sectionComponentType")),
                    ),
                )
            ).casefold()
            candidate = node.get("section") if isinstance(node.get("section"), dict) else node
            if not isinstance(candidate, dict):
                continue

            candidate_title = _clean_text(candidate.get("title"))
            candidate_items = candidate.get("items")
            looks_like_description = (
                "description" in identifier
                or candidate_title.casefold() in GENERIC_DESCRIPTION_TITLES
            )
            if not looks_like_description or not isinstance(candidate_items, list):
                continue

            default_title = "" if candidate_title.casefold() in GENERIC_DESCRIPTION_TITLES else candidate_title
            default_title_used = False

            for item in candidate_items:
                if not isinstance(item, dict):
                    continue

                item_title = _clean_text(item.get("title"))
                html_node = item.get("html")
                html_text = ""
                if isinstance(html_node, dict):
                    html_text = str(html_node.get("htmlText") or "")
                if not html_text:
                    html_text = str(item.get("subtitle") or item.get("description") or "")
                if not _clean_text(html_text):
                    continue

                title = item_title
                if not title and default_title and not default_title_used:
                    title = default_title
                    default_title_used = True

                append_section(title, _sanitize_description_modal_html(html_text))

    return sections


def _description_sections_look_truncated(sections: list[dict[str, str]]) -> bool:
    if not sections:
        return True

    combined = _description_sections_to_text(sections)
    has_heading = any(
        _clean_text(section.get("title"))
        or "<h2>" in (section.get("content") or "").lower()
        or "<h3>" in (section.get("content") or "").lower()
        for section in sections
    )
    if len(combined) < 700:
        return True
    if not has_heading and len(combined) < 1200:
        return True
    return False


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


def _normalize_image_entries(values: list[str | tuple[str, str]]) -> list[dict]:
    """Accepte des URL nues ou des couples (url, légende).

    `title` reste vide quand Airbnb ne fournit pas de légende : le front applique alors
    son propre repli (« <titre de l'annonce> — photo N ») plutôt qu'un « Photo N » générique.
    """
    out: list[dict] = []
    seen: set[str] = set()
    for value in values:
        url, caption = value if isinstance(value, tuple) else (value, "")
        clean = _clean_text(url)
        if not clean or clean in seen or not IMAGE_URL_RE.match(clean):
            continue
        seen.add(clean)
        out.append({"title": _clean_text(caption)[:160], "url": clean})
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


def _extract_average_rating(*roots: Any) -> float | None:
    rating_key_hints = {
        "ratingvalue",
        "averagerating",
        "overallrating",
        "reviewrating",
        "reviewscore",
        "starrating",
        "accuracyrating",
        "guestfavoriteaverageoverallrating",
    }

    for root in roots:
        for node in _walk(root):
            if isinstance(node, dict):
                aggregate_rating = node.get("aggregateRating")
                if isinstance(aggregate_rating, dict):
                    rating = _coerce_rating(
                        aggregate_rating.get("ratingValue")
                        or aggregate_rating.get("rating_value")
                        or aggregate_rating.get("value")
                    )
                    if rating is not None:
                        return rating

                for key, value in node.items():
                    key_name = _clean_text(key).replace("_", "").replace("-", "").casefold()
                    if key_name not in rating_key_hints:
                        continue
                    rating = _coerce_rating(value)
                    if rating is not None:
                        return rating
    return None


def _extract_review_count(*roots: Any) -> int | None:
    review_count_key_hints = {
        "reviewcount",
        "ratingcount",
        "reviewscount",
        "numberofreviews",
        "visible_review_count",
    }

    for root in roots:
        for node in _walk(root):
            if not isinstance(node, dict):
                continue

            aggregate_rating = node.get("aggregateRating")
            if isinstance(aggregate_rating, dict):
                raw_count = aggregate_rating.get("reviewCount") or aggregate_rating.get("ratingCount")
                parsed_count = _coerce_float(raw_count)
                if parsed_count is not None and parsed_count >= 0:
                    return int(round(parsed_count))

            for key, value in node.items():
                key_name = _clean_text(key).replace("_", "").replace("-", "").casefold()
                if key_name not in review_count_key_hints:
                    continue
                parsed_count = _coerce_float(value)
                if parsed_count is not None and parsed_count >= 0:
                    return int(round(parsed_count))
    return None


IMAGE_CAPTION_KEYS = {"caption", "accessibilitylabel", "alt", "alttext", "imagealttext"}


def _extract_image_caption(value: dict) -> str:
    """Légende d'une photo Airbnb (`caption`, `accessibilityLabel`…) portée par le même nœud que son URL."""
    for key, child in value.items():
        key_name = _clean_text(key).replace("_", "").replace("-", "").casefold()
        if key_name in IMAGE_CAPTION_KEYS and isinstance(child, str):
            caption = _clean_text(child)
            if caption:
                return caption
    return ""


def _collect_image_entries(value: Any) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    if isinstance(value, str):
        clean = _clean_text(value)
        if IMAGE_URL_RE.match(clean) and any(token in clean.lower() for token in ("jpg", "jpeg", "png", "webp", "picture", "image", "photo", "muscache")):
            entries.append((clean, ""))
    elif isinstance(value, dict):
        # La légende du nœud s'applique à ses URL directes ; un nœud enfant qui a la sienne la garde.
        caption = _extract_image_caption(value)
        for key, child in value.items():
            key_name = _clean_text(key).lower()
            if key_name in {"url", "image", "src", "picture", "pictureurl", "thumbnailurl"}:
                children = _collect_image_entries(child)
            elif any(token in key_name for token in ("image", "photo", "picture", "gallery")):
                children = _collect_image_entries(child)
            else:
                continue
            entries.extend((url, child_caption or caption) for url, child_caption in children)
    elif isinstance(value, list):
        for child in value:
            entries.extend(_collect_image_entries(child))
    return entries


def _extract_images_from_value(value: Any) -> list[dict]:
    return _normalize_image_entries(_collect_image_entries(value))


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


def _count_amenity_items(groups: Any) -> int:
    if not isinstance(groups, list):
        return 0
    total = 0
    for group in groups:
        if not isinstance(group, dict):
            continue
        values = group.get("values")
        if isinstance(values, list):
            total += sum(1 for item in values if isinstance(item, dict) and _clean_text(item.get("title")))
        elif _clean_text(group.get("title")):
            total += 1
    return total


def _extract_amenities_from_soup(soup: "BeautifulSoup | None") -> list[dict]:
    if soup is None:
        return []

    groups: list[dict] = []
    seen_keys: set[str] = set()
    containers = []
    for selector in AMENITY_SECTION_SELECTORS:
        containers.extend(soup.select(selector))

    for container in containers:
        current_title = "Équipements"
        container_heading = container.find(["h2", "h3"])
        if container_heading is not None:
            heading_text = _clean_text(container_heading.get_text(" ", strip=True))
            if heading_text and heading_text.casefold() not in GENERIC_AMENITY_TITLES:
                current_title = heading_text

        current_values: list[dict[str, str]] = []
        for node in container.find_all(["h3", "h4", "li", "div"], recursive=True):
            text = _clean_text(" | ".join(part for part in node.stripped_strings if _clean_text(part)))
            if not text:
                continue

            if node.name in {"h3", "h4"}:
                if current_values:
                    groups.append({"title": current_title, "values": current_values})
                    current_values = []
                if text.casefold() not in GENERIC_AMENITY_TITLES:
                    current_title = text
                continue

            strings = [_clean_text(part) for part in node.stripped_strings if _clean_text(part)]
            if not 1 <= len(strings) <= 3:
                continue

            title = strings[0]
            title_folded = title.casefold()
            if (
                not title
                or title_folded in GENERIC_AMENITY_TITLES
                or title_folded in SKIPPED_AMENITY_LINES
                or any(pattern.search(title) for pattern in AMENITY_VALUE_SKIP_PATTERNS)
            ):
                continue
            if re.search(r"\b\d{1,3}\b", title) and any(token in title_folded for token in AMENITY_EXPAND_LABELS):
                continue

            subtitle_parts = [
                part
                for part in strings[1:]
                if part.casefold() != title_folded and not any(pattern.search(part) for pattern in AMENITY_VALUE_SKIP_PATTERNS)
            ]
            item_key = f"{current_title.casefold()}::{title_folded}"
            if item_key in seen_keys:
                continue
            seen_keys.add(item_key)

            item = {"title": title}
            if subtitle_parts:
                item["subtitle"] = " - ".join(subtitle_parts)
            current_values.append(item)

        if current_values:
            groups.append({"title": current_title, "values": current_values})

    deduped_groups: list[dict] = []
    deduped_seen: set[str] = set()
    for group in groups:
        group_title = _clean_text(group.get("title") or "Équipements") or "Équipements"
        values: list[dict[str, str]] = []
        for item in group.get("values", []):
            item_title = _clean_text(item.get("title"))
            if not item_title:
                continue
            key = f"{group_title.casefold()}::{item_title.casefold()}"
            if key in deduped_seen:
                continue
            deduped_seen.add(key)
            normalized_item = {"title": item_title}
            subtitle = _clean_text(item.get("subtitle"))
            if subtitle:
                normalized_item["subtitle"] = subtitle
            values.append(normalized_item)
        if values:
            deduped_groups.append({"title": group_title, "values": values})

    return deduped_groups


def _amenities_look_truncated(amenities: list[dict], soup: "BeautifulSoup | None") -> bool:
    expected_count = _extract_amenities_expand_count_from_soup(soup)
    if expected_count is None:
        return not amenities and _soup_has_amenities_expand_button(soup)
    return _count_amenity_items(amenities) < expected_count


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
        image_entries: list[str | tuple[str, str]] = []
        if meta_image:
            image_entries.append(meta_image)
        for root in roots:
            image_entries.extend(_collect_image_entries(root))
        images = _normalize_image_entries(image_entries)

    amenities = result.get("amenities")
    if not isinstance(amenities, list) or not amenities:
        for root in roots:
            extracted = _extract_amenities_from_value(root)
            if extracted:
                amenities = extracted
                break
        if not isinstance(amenities, list):
            amenities = []
    soup_amenities = _extract_amenities_from_soup(soup)
    if _count_amenity_items(soup_amenities) > _count_amenity_items(amenities):
        amenities = soup_amenities

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
    structured_description_sections = _extract_description_sections_from_value(*roots)
    soup_description_sections = _extract_description_sections_from_soup(soup)
    description_sections = structured_description_sections
    if len(_description_sections_to_text(soup_description_sections)) > len(_description_sections_to_text(description_sections)):
        description_sections = soup_description_sections
    description_sections = [section for section in description_sections if not _should_skip_description_section(section)]
    description = _render_description_html(description_sections, description_preview)
    precise_address = _first_non_empty(result.get("precise_address"), location.get("precise_address"))
    city = _first_non_empty(result.get("city"), location.get("city"))
    region = _first_non_empty(result.get("region"), location.get("region"))
    country = _first_non_empty(result.get("country"), location.get("country"), "France")
    price = _coerce_price(result.get("price"))
    if price is None:
        price = _extract_price(*roots, ld_listing.get("offers"))
    average_rating = _extract_average_rating(result, embedded_data, raw_deferred, ld_listing)
    review_count = _extract_review_count(result, embedded_data, raw_deferred, ld_listing)

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
    amenities_indiehost = translate_amenities_to_indiehost(amenities, highlight_titles)

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
        "amenities_indiehost": amenities_indiehost,
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
    if average_rating is not None:
        normalized["average_rating"] = average_rating
    if review_count is not None:
        normalized["review_count"] = review_count
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


def _extract_embedded_payload_from_soup(soup: "BeautifulSoup") -> tuple[Any, Any]:
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
    return embedded_data, raw_deferred


def _click_best_labeled_button(page, labels: tuple[str, ...]) -> bool:
    try:
        return bool(page.evaluate(
            """
            (tokens) => {
              const normalize = (value) => (value || '')
                .normalize('NFD')
                .replace(/[\\u0300-\\u036f]/g, '')
                .toLowerCase()
                .replace(/\\s+/g, ' ')
                .trim();

              const nodes = Array.from(document.querySelectorAll('button, [role="button"]'));
              let bestNode = null;
              let bestScore = -1;

              for (const node of nodes) {
                const text = normalize(`${node.getAttribute('aria-label') || ''} ${node.innerText || node.textContent || ''}`);
                if (!text) continue;
                if (!tokens.some((token) => text.includes(normalize(token)))) continue;

                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                const visible = rect.width > 0
                  && rect.height > 0
                  && style.visibility !== 'hidden'
                  && style.display !== 'none';
                if (!visible) continue;

                const countMatch = text.match(/\\b(\\d{1,3})\\b/);
                const countScore = countMatch ? Number.parseInt(countMatch[1], 10) : 0;
                const score = countScore * 1000 + text.length;
                if (score > bestScore) {
                  bestScore = score;
                  bestNode = node;
                }
              }

              if (!bestNode) return false;
              bestNode.scrollIntoView({ block: 'center', inline: 'center' });
              bestNode.click();
              return true;
            }
            """,
            list(labels),
        ))
    except Exception:
        return False


def _scroll_best_amenities_modal(page) -> bool:
    try:
        return bool(page.evaluate(
            """
            (tokens) => {
              const normalize = (value) => (value || '')
                .normalize('NFD')
                .replace(/[\\u0300-\\u036f]/g, '')
                .toLowerCase()
                .replace(/\\s+/g, ' ')
                .trim();

              const selectors = [
                '[role="dialog"]',
                '[aria-modal="true"]',
                '[data-section-id*="AMENIT"]',
                '[data-plugin-in-point-id*="AMENIT"]',
                '[data-cursor-amenities-modal]'
              ];

              const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
              let bestNode = null;
              let bestScore = -1;

              for (const node of nodes) {
                const text = normalize(node.innerText || node.textContent || '');
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                const visible = rect.width > 0
                  && rect.height > 0
                  && style.visibility !== 'hidden'
                  && style.display !== 'none';
                if (!visible) continue;

                const matchesLabel = tokens.some((token) => text.includes(normalize(token)));
                const itemCount = node.querySelectorAll('li').length + node.querySelectorAll('[data-testid*="amenit"]').length;
                const score = (matchesLabel ? 100000 : 0) + itemCount * 100 + text.length;
                if (score > bestScore) {
                  bestScore = score;
                  bestNode = node;
                }
              }

              if (!bestNode) return false;

              const scrollTargets = [bestNode, ...bestNode.querySelectorAll('*')]
                .filter((node) => node.scrollHeight > node.clientHeight + 12);

              bestNode.scrollIntoView({ block: 'center', inline: 'center' });
              for (const node of scrollTargets) {
                node.scrollTo(0, node.scrollHeight);
              }
              window.scrollTo(0, document.body.scrollHeight);
              return true;
            }
            """,
            list(AMENITY_EXPAND_LABELS),
        ))
    except Exception:
        return False


def _capture_best_amenities_modal_html(page) -> str:
    try:
        return page.evaluate(
            """
            (tokens) => {
              const normalize = (value) => (value || '')
                .normalize('NFD')
                .replace(/[\\u0300-\\u036f]/g, '')
                .toLowerCase()
                .replace(/\\s+/g, ' ')
                .trim();

              const selectors = [
                '[role="dialog"]',
                '[aria-modal="true"]',
                '[data-section-id*="AMENIT"]',
                '[data-plugin-in-point-id*="AMENIT"]',
                '[data-cursor-amenities-modal]'
              ];

              const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
              let bestNode = null;
              let bestScore = -1;

              for (const node of nodes) {
                const text = normalize(node.innerText || node.textContent || '');
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                const visible = rect.width > 0
                  && rect.height > 0
                  && style.visibility !== 'hidden'
                  && style.display !== 'none';
                if (!visible) continue;

                const matchesLabel = tokens.some((token) => text.includes(normalize(token)));
                const itemCount = node.querySelectorAll('li').length + node.querySelectorAll('[data-testid*="amenit"]').length;
                const score = (matchesLabel ? 100000 : 0) + itemCount * 100 + text.length;
                if (score > bestScore) {
                  bestScore = score;
                  bestNode = node;
                }
              }

              return bestNode ? (bestNode.outerHTML || '') : '';
            }
            """,
            list(AMENITY_EXPAND_LABELS),
        ) or ""
    except Exception:
        return ""


def _fetch_page_context_with_playwright(url: str, proxy_url: str) -> tuple["BeautifulSoup", Any, Any]:
    if not HAS_PLAYWRIGHT:
        raise RuntimeError("Playwright indisponible")

    proxy = {"server": proxy_url} if proxy_url else None
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            proxy=proxy,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--headless=new",
            ],
        )
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="fr-FR",
            viewport={"width": 1440, "height": 1800},
        )
        page = ctx.new_page()

        if HAS_STEALTH:
            Stealth().apply_stealth_sync(page)

        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
        """)

        page.goto(url, wait_until="domcontentloaded", timeout=20_000)
        page.wait_for_timeout(1_500)

        for sel in [
            "#onetrust-accept-btn-handler",
            "button[data-testid='accept-btn']",
            "button[aria-label*='cookie' i]",
        ]:
            try:
                btn = page.locator(sel).first
                if btn.is_visible(timeout=1_500):
                    btn.click()
                    page.wait_for_timeout(600)
                    break
            except Exception:
                continue

        description_modal_html = ""
        for sel in [
            "button:has-text('Lire la suite')",
            "button:has-text('Afficher plus')",
            "button:has-text('Voir plus')",
            "button[aria-label*='Show more about this place' i]",
            "button[aria-label*='about this place' i]",
            "button[aria-label*='À propos de ce logement' i]",
            "button[aria-label*='A propos de ce logement' i]",
            "button[aria-label*='description' i]",
        ]:
            try:
                btn = page.locator(sel).first
                if btn.is_visible(timeout=3_000):
                    btn.click()
                    page.wait_for_timeout(2_000)
                    for modal_sel in (
                        "[data-section-id='DESCRIPTION_MODAL']",
                        "[data-plugin-in-point-id='DESCRIPTION_MODAL']",
                        "[role='dialog']",
                    ):
                        try:
                            modal = page.locator(modal_sel).last
                            modal.wait_for(timeout=5_000)
                            description_modal_html = modal.evaluate("el => el.outerHTML") or ""
                            if description_modal_html:
                                break
                        except Exception:
                            continue
                    break
            except Exception:
                continue

        try:
            page.locator("[data-section-id='DESCRIPTION_MODAL'], [data-plugin-in-point-id='DESCRIPTION_MODAL']").first.wait_for(timeout=5_000)
        except Exception:
            pass

        if description_modal_html:
            try:
                page.keyboard.press("Escape")
                page.wait_for_timeout(800)
            except Exception:
                pass

        amenities_modal_html = ""
        clicked_amenities_expand = False
        for sel in [
            "button:has-text('Afficher les')",
            "button:has-text('équipements')",
            "button:has-text('equipements')",
            "button:has-text('Show all amenities')",
            "button:has-text('What this place offers')",
        ]:
            try:
                btn = page.locator(sel).first
                if btn.is_visible(timeout=2_000):
                    btn.click()
                    clicked_amenities_expand = True
                    page.wait_for_timeout(1_500)
                    break
            except Exception:
                continue

        if not clicked_amenities_expand:
            clicked_amenities_expand = _click_best_labeled_button(page, AMENITY_EXPAND_LABELS)
            if clicked_amenities_expand:
                page.wait_for_timeout(1_500)

        if clicked_amenities_expand:
            for _ in range(6):
                _scroll_best_amenities_modal(page)
                page.wait_for_timeout(350)

            for modal_sel in (
                "[role='dialog']",
                "[aria-modal='true']",
                "[data-section-id*='AMENIT']",
                "[data-plugin-in-point-id*='AMENIT']",
            ):
                try:
                    modal = page.locator(modal_sel).last
                    modal.wait_for(timeout=5_000)
                    amenities_modal_html = modal.evaluate("el => el.outerHTML") or ""
                    if amenities_modal_html:
                        break
                except Exception:
                    continue

            if not amenities_modal_html:
                amenities_modal_html = _capture_best_amenities_modal_html(page)

        html_doc = page.content()
        if description_modal_html:
            html_doc = html_doc.replace(
                "</body>",
                f'<div data-cursor-description-modal="true">{description_modal_html}</div></body>',
                1,
            )
        if amenities_modal_html:
            html_doc = html_doc.replace(
                "</body>",
                f'<div data-cursor-amenities-modal="true">{amenities_modal_html}</div></body>',
                1,
            )
        browser.close()

    soup = BeautifulSoup(html_doc, "html.parser")
    embedded_data, raw_deferred = _extract_embedded_payload_from_soup(soup)
    return soup, embedded_data, raw_deferred


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
    embedded_data, raw_deferred = _extract_embedded_payload_from_soup(soup)
    structured_description_sections = _extract_description_sections_from_value(embedded_data, raw_deferred)
    structured_amenities = _extract_amenities_from_value(embedded_data)
    deferred_amenities = _extract_amenities_from_value(raw_deferred)
    if _count_amenity_items(deferred_amenities) > _count_amenity_items(structured_amenities):
        structured_amenities = deferred_amenities
    soup_amenities = _extract_amenities_from_soup(soup)
    if _count_amenity_items(soup_amenities) > _count_amenity_items(structured_amenities):
        structured_amenities = soup_amenities
    description_needs_expand = (
        not structured_description_sections
        and _soup_has_description_expand_button(soup)
        and _description_sections_look_truncated(_extract_description_sections_from_soup(soup))
    )
    amenities_need_expand = _soup_has_amenities_expand_button(soup)

    # Tenter l'ouverture des modals Airbnb (description / équipements) via Playwright avec un timeout strict.
    use_playwright = HAS_PLAYWRIGHT and (description_needs_expand or amenities_need_expand)

    if use_playwright:
        executor = ThreadPoolExecutor(max_workers=1)
        try:
            future = executor.submit(_fetch_page_context_with_playwright, url, proxy_url)
            rich_soup, rich_embedded_data, rich_raw_deferred = future.result(timeout=PLAYWRIGHT_TIMEOUT_SECONDS)
            rich_sections = _extract_description_sections_from_soup(rich_soup)
            rich_amenities = _extract_amenities_from_soup(rich_soup)
            if rich_sections or rich_amenities:
                return (
                    rich_soup,
                    rich_embedded_data if rich_embedded_data is not None else embedded_data,
                    rich_raw_deferred if rich_raw_deferred is not None else raw_deferred,
                )
        except FuturesTimeoutError:
            future.cancel()
            _safe_print("Ouverture des modals Airbnb (description / équipements) : timeout, utilisation du HTML initial.", file=sys.stderr)
        except Exception as e:  # pragma: no cover - enrichissement best effort
            _safe_print(f"Ouverture du modal Airbnb indisponible: {e}", file=sys.stderr)
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

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
