"""
API FastAPI pour le scraper Indie Host.
Expose un endpoint POST /scrape pour récupérer les données d'une annonce Airbnb.
Service stateless : aucune donnée n'est stockée.
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from airbnb_scraper import scrape_listing


class ScrapeRequest(BaseModel):
    """Requête de scraping."""

    url: str = Field(..., description="URL de l'annonce Airbnb (ex. https://www.airbnb.fr/rooms/123456)")
    currency: str = Field(default="EUR", description="Code devise")
    check_in: str = Field(default="", description="Date check-in YYYY-MM-DD (optionnel)")
    check_out: str = Field(default="", description="Date check-out YYYY-MM-DD (optionnel)")
    proxy_url: str = Field(default="", description="URL proxy optionnelle")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cycle de vie de l'application (vide, pas de DB)."""
    yield


app = FastAPI(
    title="Indie Host Scraping API",
    description="API de scraping pour importer des annonces Airbnb vers Indie Host",
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
    Scrape une annonce Airbnb par URL.
    Retourne les données brutes (coordonnées, équipements, photos, etc.).
    Aucune donnée n'est stockée côté serveur.
    """
    url = (request.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="L'URL est requise")

    if "airbnb" not in url.lower():
        raise HTTPException(
            status_code=400,
            detail="Seules les URLs Airbnb sont supportées pour le moment (ex. https://www.airbnb.fr/rooms/123456)",
        )

    try:
        data = await asyncio.to_thread(
            scrape_listing,
            url=url,
            currency=request.currency or "EUR",
            check_in=request.check_in or "",
            check_out=request.check_out or "",
            proxy_url=request.proxy_url or "",
        )
        return data
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Impossible de récupérer l'annonce : {str(e)}",
        ) from e
