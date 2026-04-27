"""
Correspondance des amenities Booking.com -> IndieHost.

Booking expose souvent des libelles plats (FR/EN) sans structure stable selon
la fiche, la langue et les experiments de l'UI. Ce module centralise donc les
libelles les plus frequents observes sur les pages property Booking et les
traduit vers les amenities IndieHost existantes.

Les amenities Booking sans equivalent clair dans le catalogue IndieHost
(restaurant, navette aeroport, chambres non-fumeurs, etc.) sont volontairement
ignorees ici : le but est de produire une liste IndieHost propre plutot qu'un
mapping force.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from airbnb_amenity_mapping import INDIEHOST_AMENITIES


BASE_INDIEHOST_BY_ID: dict[str, dict[str, Any]] = {
    str(entry.get("id")): entry
    for entry in INDIEHOST_AMENITIES
    if entry.get("id")
}


BOOKING_PATTERNS_BY_ID: dict[str, list[str]] = {
    # Confort & travail
    "WIFI": [
        "wifi",
        "wi fi",
        "free wifi",
        "internet",
        "internet services",
        "wireless internet",
        "connexion internet",
    ],
    "DEDICATED_WORKSPACE": [
        "desk",
        "bureau",
        "workspace",
        "work desk",
        "espace de travail",
        "laptop friendly workspace",
    ],
    "REVERSIBLE_AIR_CONDITIONING": [
        "air conditioning",
        "air conditioned",
        "climatisation",
        "air conditionne",
    ],
    "PORTABLE_AIR_CONDITIONING": [
        "portable air conditioner",
        "portable air conditioning",
        "climatisation mobile",
    ],
    "SPACE_HEATER": [
        "heating",
        "heater",
        "chauffage",
        "radiateur",
    ],
    "CENTRAL_HEATING": [
        "central heating",
        "chauffage central",
    ],
    "BLACKOUT_CURTAINS": [
        "blackout curtains",
        "blackout blinds",
        "rideaux occultants",
        "stores occultants",
        "volets roulants",
    ],
    "LINENS_PROVIDED": [
        "linens",
        "linen",
        "bed linen",
        "bed linens",
        "linge de maison",
        "serviettes",
        "towels",
        "bath towels",
        "sheets",
        "draps",
    ],
    "HAIR_DRYER": [
        "hair dryer",
        "seche cheveux",
        "seche cheveux",
    ],
    "MOSQUITO_NET": [
        "mosquito net",
        "moustiquaire",
    ],
    "EXTRA_PILLOWS_BLANKETS": [
        "extra pillows",
        "extra blankets",
        "oreillers supplementaires",
        "couvertures supplementaires",
    ],
    "CEILING_FAN": [
        "ceiling fan",
        "ventilateur de plafond",
    ],
    "PORTABLE_FAN": [
        "portable fan",
        "fan",
        "ventilator",
        "ventilateur",
    ],
    "LAUNDROMAT_NEARBY": [
        "laundromat",
        "laverie",
    ],
    "CLEANING_DURING_STAY": [
        "daily housekeeping",
        "housekeeping",
        "menage quotidien",
        "cleaning during stay",
    ],

    # Cuisine & boissons
    "EQUIPPED_KITCHEN": [
        "kitchen",
        "cuisine",
        "kitchenette",
        "kitchenware",
        "cooking facilities",
        "shared kitchen",
        "cuisine equipee",
    ],
    "OUTDOOR_KITCHEN": [
        "outdoor kitchen",
        "cuisine exterieure",
    ],
    "NESPRESSO_COFFEE_MACHINE": [
        "nespresso",
        "espresso machine",
        "expresso machine",
    ],
    "FILTER_COFFEE_MAKER": [
        "coffee maker",
        "coffee machine",
        "cafetiere",
        "machine a cafe",
        "machine a cafe",
    ],
    "KETTLE_AND_TEA": [
        "kettle",
        "electric kettle",
        "bouilloire",
        "tea coffee maker",
        "tea maker",
    ],
    "DISHWASHER": [
        "dishwasher",
        "lave vaisselle",
    ],
    "MICROWAVE": [
        "microwave",
        "micro ondes",
        "micro ondes",
        "micro onde",
    ],
    "STOVE": [
        "stovetop",
        "hob",
        "cooking hob",
        "plaque de cuisson",
    ],
    "OVEN": [
        "oven",
        "four",
    ],
    "REFRIGERATOR": [
        "refrigerator",
        "fridge",
        "refrigerateur",
        "refrigerateur",
        "refrigerateur",
    ],
    "DINING_TABLE": [
        "dining table",
        "table a manger",
        "table a manger",
        "coin repas",
        "dining area",
    ],
    "FREEZER": [
        "freezer",
        "congelateur",
    ],
    "TOASTER": [
        "toaster",
        "grille pain",
    ],
    "RICE_COOKER": [
        "rice cooker",
        "cuiseur a riz",
    ],
    "BLENDER": [
        "blender",
        "mixeur",
    ],
    "WINE_GLASSES": [
        "wine glasses",
        "verres a vin",
    ],
    "BREAD_MACHINE": [
        "bread machine",
        "machine a pain",
    ],
    "BREAKFAST": [
        "breakfast",
        "petit dejeuner",
        "continental breakfast",
        "breakfast included",
    ],

    # Exterieur & detente
    "OUTDOOR_DINING_AREA": [
        "outdoor dining area",
        "outdoor furniture",
        "patio furniture",
        "picnic area",
        "aire de pique nique",
    ],
    "WOOD_TERRACE": [
        "terrace",
        "sun terrace",
        "terrasse",
        "terrasse bien exposee",
        "patio",
        "deck",
        "balcony",
    ],
    "SUN_LOUNGERS": [
        "sun loungers",
        "deck chairs",
        "transats",
    ],
    "HAMMOCK": [
        "hammock",
        "hamac",
    ],
    "ELECTRIC_BARBECUE": [
        "barbecue",
        "bbq",
        "grill",
        "barbecue facilities",
    ],
    "PLANCHA_GRILL": [
        "plancha",
    ],
    "OUTDOOR_SHOWER": [
        "outdoor shower",
        "douche exterieure",
    ],
    "HEATED_POOL": [
        "heated pool",
        "piscine chauffee",
    ],
    "POOL": [
        "swimming pool",
        "outdoor pool",
        "indoor pool",
        "pool with view",
        "piscine",
        "pool",
    ],
    "HOT_TUB": [
        "hot tub",
        "jacuzzi",
        "spa bath",
        "bain a remous",
        "whirlpool",
    ],
    "GARDEN": [
        "garden",
        "jardin",
    ],
    "SAUNA": [
        "sauna",
    ],
    "FIRE_PIT": [
        "fire pit",
        "brasero",
    ],
    "KAYAK": [
        "kayak",
    ],
    "BICYCLES": [
        "bicycle rental",
        "bicycles",
        "bikes",
        "velos",
    ],
    "KIDS_BICYCLES": [
        "kids bikes",
        "children bicycles",
        "velo enfant",
    ],
    "OUTDOOR_PLAY_AREA": [
        "playground",
        "outdoor play equipment",
        "children playground",
        "aire de jeux",
    ],
    "MINIGOLF": [
        "mini golf",
        "minigolf",
    ],
    "HOCKEY_RINK": [
        "hockey rink",
    ],
    "SKATEBOARD_RAMP": [
        "skateboard ramp",
        "skate park",
    ],
    "RESORT_ACCESS": [
        "resort access",
    ],
    "SKI_IN_SKI_OUT": [
        "ski to door",
        "ski in ski out",
        "au pied des pistes",
    ],
    "BEACH_ESSENTIALS": [
        "beach umbrellas",
        "beach chairs",
        "pool beach towels",
        "serviettes de plage",
        "parasols",
    ],
    "BOAT_LAUNCH": [
        "boat launch",
        "mise a l eau",
        "slipway",
    ],

    # Vue & acces
    "WALK_TO_BEACH": [
        "beachfront",
        "beach access",
        "private beach area",
        "plage privee",
        "bord de mer",
    ],
    "PANORAMIC_LAKE_VIEW": [
        "lake view",
        "vue sur le lac",
        "panoramic lake view",
        "vue panoramique",
    ],
    "MONT_BLANC_VIEW": [
        "mont blanc view",
        "vue mont blanc",
    ],
    "CANAL_VIEW": [
        "canal view",
        "vue sur le canal",
    ],
    "EASY_METRO_ACCESS": [
        "metro nearby",
        "subway nearby",
        "near metro",
        "acces metro",
        "station de metro",
    ],

    # Arrivee & mobilite
    "ELEVATOR": [
        "elevator",
        "lift",
        "ascenseur",
    ],
    "PRIVATE_PARKING": [
        "private parking",
        "parking prive",
        "secured parking",
        "garage parking",
    ],
    "FREE_PARKING_ON_PREMISES": [
        "free parking",
        "parking gratuit",
        "free parking on site",
        "parking gratuit sur place",
        "parking on site",
    ],
    "PARKING_FOR_TWO_CARS": [
        "parking for two cars",
        "two parking spaces",
        "2 parking spaces",
    ],
    "FREE_STREET_PARKING": [
        "free street parking",
        "street parking",
        "stationnement dans la rue",
    ],
    "PAID_PARKING_ON_PREMISES": [
        "paid parking on site",
        "parking payant sur place",
    ],
    "PAID_PARKING_OFF_PREMISES": [
        "paid parking off site",
        "paid parking",
        "parking payant",
    ],
    "EV_CHARGER": [
        "ev charging station",
        "electric vehicle charging station",
        "borne de recharge",
    ],
    "SELF_CHECK_IN": [
        "self check in",
        "self check-in",
        "arrivee autonome",
        "entree autonome",
    ],
    "SMART_LOCK": [
        "smart lock",
        "keyless entry",
        "serrure connectee",
        "keypad",
    ],
    "STEP_FREE_ACCESS": [
        "step free access",
        "entire unit located on ground floor",
        "wheelchair accessible",
        "rez de chaussee",
        "ground floor unit",
    ],
    "PRIVATE_ENTRANCE": [
        "private entrance",
        "entree privee",
    ],
    "LUGGAGE_DROP": [
        "luggage storage",
        "baggage storage",
        "bagagerie",
        "luggage dropoff allowed",
    ],

    # Securite
    "SAFE": [
        "safe",
        "coffre fort",
    ],
    "SMOKE_ALARM": [
        "smoke alarm",
        "detecteur de fumee",
    ],
    "CARBON_MONOXIDE_ALARM": [
        "carbon monoxide alarm",
        "monoxyde de carbone",
    ],
    "FIRST_AID_KIT": [
        "first aid kit",
        "trousse de secours",
    ],
    "FIRE_EXTINGUISHER": [
        "fire extinguisher",
        "extincteur",
    ],

    # Divertissement
    "SMART_TV": [
        "smart tv",
        "flat screen tv",
        "television",
        "streaming service",
        "netflix",
    ],
    "CABLE_TV": [
        "cable channels",
        "satellite channels",
        "cable tv",
    ],
    "BLUETOOTH_SPEAKER": [
        "bluetooth speaker",
        "enceinte bluetooth",
    ],
    "BOARD_GAMES": [
        "board games",
        "jeux de societe",
    ],
    "MINI_LIBRARY": [
        "books",
        "livres",
        "mini library",
    ],
    "PIANO": [
        "piano",
    ],
    "EXERCISE_EQUIPMENT": [
        "exercise equipment",
        "fitness",
        "gym equipment",
        "equipement de fitness",
    ],
    "POOL_TABLE": [
        "pool table",
        "billard",
    ],
    "PING_PONG_TABLE": [
        "table tennis",
        "ping pong",
        "tennis de table",
    ],
    "BOWLING_LANE": [
        "bowling lane",
        "bowling",
    ],
    "GAMING_CONSOLE": [
        "gaming console",
        "game console",
        "console de jeux",
    ],
    "ARCADE_GAMES": [
        "arcade games",
        "jeux d arcade",
    ],
    "GIANT_GAMES": [
        "giant games",
        "jeux geants",
    ],
    "LASER_GAME": [
        "laser game",
        "laser tag",
    ],

    # Buanderie / salle de bain
    "WASHER": [
        "washing machine",
        "washer",
        "lave linge",
    ],
    "DRYER": [
        "dryer",
        "tumble dryer",
        "seche linge",
    ],
    "IRON": [
        "iron",
        "fer a repasser",
    ],
    "HANGERS": [
        "hanger",
        "hangers",
        "cintres",
        "wardrobe or closet",
        "penderie",
    ],
    "ESSENTIALS": [
        "free toiletries",
        "basic toiletries",
        "papier toilette",
        "toilet paper",
        "soap",
        "body soap",
        "shampoo",
        "conditioner",
        "articles de toilette gratuits",
        "essentials",
    ],
    "BATHTUB": [
        "bathtub",
        "baignoire",
    ],
    "HOT_WATER": [
        "hot water",
        "eau chaude",
    ],
    "BIDET": [
        "bidet",
    ],
    "CLEANING_SUPPLIES": [
        "cleaning products",
        "cleaning supplies",
        "produits menagers",
    ],
    "TRASH_COMPACTOR": [
        "trash compactor",
        "compacteur de dechets",
    ],

    # Famille
    "TRAVEL_CRIB": [
        "crib",
        "baby cot",
        "travel crib",
        "lit bebe",
    ],
    "HIGH_CHAIR": [
        "high chair",
        "chaise haute",
    ],
    "CHILDREN_BOOKS_TOYS": [
        "children books",
        "children toys",
        "livres enfants",
        "jouets",
    ],
    "BABY_MONITOR": [
        "baby monitor",
        "ecoute bebe",
    ],
    "SAFETY_GATE": [
        "safety gate",
        "safety gates",
        "barriere de securite",
    ],
    "BABY_BATHTUB": [
        "baby bathtub",
        "baby bath",
        "baignoire bebe",
    ],
    "OUTLET_COVERS": [
        "outlet covers",
        "socket covers",
        "cache prises",
    ],
    "WINDOW_GUARDS": [
        "window guards",
        "protection fenetres",
    ],
    "TABLE_CORNER_GUARDS": [
        "table corner guards",
        "coins de table",
    ],
    "CHANGING_TABLE": [
        "changing table",
        "table a langer",
    ],
    "BABYSITTER_RECOMMENDATIONS": [
        "babysitter recommendations",
        "garde d enfants recommandee",
    ],

    # Divers
    "PRIVATE_LOUNGE": [
        "private lounge",
        "executive lounge access",
        "salon prive",
    ],
    "THEMED_ROOM": [
        "themed room",
        "chambre a theme",
    ],
    "LONG_TERM_STAYS": [
        "long term stays",
        "long term stays allowed",
        "sejours longue duree",
    ],
}


HIGHLIGHT_GROUP_PATTERNS = {
    "ses points forts",
    "most popular facilities",
    "popular facilities",
    "popular amenities",
}


def _normalize_for_match(text: str) -> str:
    if not text:
        return ""
    s = unicodedata.normalize("NFD", text)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s


def _build_booking_entries() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for amenity_id, patterns in BOOKING_PATTERNS_BY_ID.items():
        base = BASE_INDIEHOST_BY_ID.get(amenity_id)
        if not base:
            continue
        entries.append({
            **{k: v for k, v in base.items() if k != "patterns"},
            "patterns": patterns,
        })
    return entries


BOOKING_INDIEHOST_AMENITIES = _build_booking_entries()


def _build_match_candidates(title: str, subtitle: str = "", category: str = "") -> set[str]:
    values = [
        _normalize_for_match(title),
        _normalize_for_match(subtitle),
        _normalize_for_match(category),
    ]
    candidates: set[str] = set()

    for value in values:
        if not value:
            continue
        candidates.add(value)
        candidates.add(value.replace(" ", ""))

    combined = " ".join(value for value in values if value).strip()
    if combined:
        candidates.add(combined)
        candidates.add(combined.replace(" ", ""))

    return candidates


def _pattern_matches(candidates: set[str], pattern: str) -> bool:
    normalized_pattern = _normalize_for_match(pattern)
    if not normalized_pattern:
        return False

    compact_pattern = normalized_pattern.replace(" ", "")
    for candidate in candidates:
        if normalized_pattern == candidate or compact_pattern == candidate:
            return True
        if len(normalized_pattern) >= 4 and normalized_pattern in candidate:
            return True
        if len(compact_pattern) >= 8 and compact_pattern in candidate:
            return True
    return False


def _build_description(title: str, subtitle: str, mapped_name: str) -> str:
    if subtitle.strip():
        return subtitle.strip()

    normalized_title = _normalize_for_match(title)
    normalized_name = _normalize_for_match(mapped_name)
    if not normalized_title or not normalized_name:
        return ""
    if (
        normalized_title == normalized_name
        or normalized_title in normalized_name
        or normalized_name in normalized_title
    ):
        return ""
    return title.strip()


def map_booking_amenity_to_indiehost(
    title: str,
    subtitle: str = "",
    category: str = "",
) -> dict[str, Any] | None:
    """
    Retourne l'amenity IndieHost correspondant au libelle Booking, ou None.
    """
    candidates = _build_match_candidates(title, subtitle, category)
    if not candidates:
        return None

    for entry in BOOKING_INDIEHOST_AMENITIES:
        for pattern in entry.get("patterns") or []:
            if not _pattern_matches(candidates, pattern):
                continue

            description = _build_description(title, subtitle, str(entry.get("name", "")))
            out = {
                "id": entry["id"],
                "name": entry["name"],
                "description": description,
                "category": entry["category"],
                "relevance": entry.get("relevance", 50),
                "perkEligible": entry.get("perkEligible", False),
                "perkScore": entry.get("perkScore"),
                "perkPriority": entry.get("perkPriority"),
            }
            return {k: v for k, v in out.items() if v is not None and v != ""}

    return None


def translate_booking_amenities_to_indiehost(
    raw_amenities: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Traduit les amenities Booking brutes (groupes avec values) en liste
    d'amenities IndieHost.
    """
    seen_ids: set[str] = set()
    seen_keys: set[str] = set()
    out: list[dict[str, Any]] = []

    for group in raw_amenities or []:
        group_title = str(group.get("title") or "").strip()
        normalized_group_title = _normalize_for_match(group_title)
        values = group.get("values") or group.get("items") or []

        for item in values:
            if not isinstance(item, dict):
                continue
            if item.get("available") is False:
                continue

            title = str(item.get("title") or item.get("name") or item.get("label") or "").strip()
            if not title:
                continue
            subtitle = str(item.get("subtitle") or item.get("description") or "").strip()

            mapped = map_booking_amenity_to_indiehost(title, subtitle, group_title)
            if not mapped:
                continue

            amenity_id = str(mapped.get("id") or "").strip()
            key = f"{group_title}::{title}"
            if not amenity_id or amenity_id in seen_ids or key in seen_keys:
                continue

            if normalized_group_title in HIGHLIGHT_GROUP_PATTERNS:
                mapped["relevance"] = max(int(mapped.get("relevance", 0) or 0), 95)
                mapped["pinned"] = True

            seen_ids.add(amenity_id)
            seen_keys.add(key)
            out.append(mapped)

    return out
