"""
API FastAPI pour le scraper Indie Host.
Expose un endpoint POST /scrape pour récupérer les données d'une annonce Airbnb ou Booking.
Service stateless : aucune donnée n'est stockée.
"""
import asyncio
import re
from contextlib import asynccontextmanager

# Chargement automatique du fichier .env (SCRAPFLY_KEY, etc.)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from airbnb_scraper import scrape_listing as scrape_airbnb
from booking_scraper import scrape_listing as scrape_booking


def _normalize_listing_url(url: str) -> str:
    """
    Normalise les liens partagés (ex. mobile iPhone sans https, avec query params)
    en URL canonique reconnue par la détection et les scrapers.
    """
    u = url.strip()
    # Airbnb: airbnb.fr/rooms/123?unique_share_id=... ou www.airbnb.fr/rooms/123
    m = re.match(
        r"(?i)(?:https?://)?(?:www\.)?(airbnb\.(?:fr|com|co\.uk|es|de|it))/rooms/(\d+)",
        u,
    )
    if m:
        return f"https://www.{m.group(1)}/rooms/{m.group(2)}"
    # Booking: booking.com/hotel/...
    m = re.match(r"(?i)(?:https?://)?(?:www\.)?(booking\.com/hotel/[^?#]+)", u)
    if m:
        return f"https://www.{m.group(1)}"
    return u


def _detect_source(url: str) -> str | None:
    """Détecte la source (airbnb ou booking) depuis l'URL."""
    u = url.lower()
    if "airbnb" in u and "/rooms/" in u:
        return "airbnb"
    if "booking.com" in u and "/hotel/" in u:
        return "booking"
    return None


class ScrapeRequest(BaseModel):
    """Requête de scraping."""

    url: str = Field(
        ...,
        description="URL Airbnb (ex. https://www.airbnb.fr/rooms/123456) ou Booking (ex. https://www.booking.com/hotel/fr/xxx.html)",
    )
    currency: str = Field(default="EUR", description="Code devise (Airbnb uniquement)")
    check_in: str = Field(default="", description="Date check-in YYYY-MM-DD (optionnel, Airbnb)")
    check_out: str = Field(default="", description="Date check-out YYYY-MM-DD (optionnel, Airbnb)")
    proxy_url: str = Field(default="", description="URL proxy optionnelle")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cycle de vie de l'application (vide, pas de DB)."""
    yield


app = FastAPI(
    title="Indie Host Scraping API",
    description="API de scraping pour importer des annonces Airbnb et Booking vers Indie Host",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Health check pour le déploiement."""
    return {"status": "ok", "service": "indiehost-scraping"}


@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    """
    Scrape une annonce Airbnb ou Booking par URL.
    Retourne les données brutes (coordonnées, équipements, photos, etc.).
    Aucune donnée n'est stockée côté serveur.
    """
    url = (request.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="L'URL est requise")

    url = _normalize_listing_url(url)
    source = _detect_source(url)
    if not source:
        raise HTTPException(
            status_code=400,
            detail="URL non supportée. Utilisez un lien Airbnb (https://www.airbnb.fr/rooms/…) ou Booking (https://www.booking.com/hotel/…).",
        )

    # Certains environnements / connexions (notamment depuis des réseaux mobiles ou Wi‑Fi instables)
    # peuvent provoquer des erreurs bas-niveau du type "[Errno 32] Broken pipe" pendant le scraping.
    # On applique donc une petite logique de retry côté API avant de remonter une 422 au frontend.
    max_retries = 3
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            if source == "airbnb":
                data = await asyncio.to_thread(
                    scrape_airbnb,
                    url=url,
                    currency=request.currency or "EUR",
                    check_in=request.check_in or "",
                    check_out=request.check_out or "",
                    proxy_url=request.proxy_url or "",
                )
            else:
                data = await asyncio.to_thread(
                    scrape_booking,
                    url=url,
                    proxy_url=request.proxy_url or "",
                )
            return data
        except Exception as e:  # noqa: BLE001
            last_error = e

            # Cas particulier : erreurs de type "Broken pipe" (errno 32) → on retente quelques fois.
            errno = getattr(e, "errno", None)
            message = str(e)
            is_broken_pipe = errno == 32 or "Broken pipe" in message

            if is_broken_pipe and attempt < max_retries:
                # Backoff léger avant de retenter
                await asyncio.sleep(0.8 * attempt)
                continue

            # Autres erreurs (ou nombre de tentatives épuisé) : on renvoie au frontend.
            raise HTTPException(
                status_code=422,
                detail=f"Impossible de récupérer l'annonce : {message}",
            ) from e

    # Sécurité (ne devrait pas être atteint, mais garde un message propre si jamais)
    raise HTTPException(
        status_code=422,
        detail=f"Impossible de récupérer l'annonce après {max_retries} tentatives : {last_error}",
    )
