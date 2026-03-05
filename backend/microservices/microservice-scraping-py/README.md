# Scraper Airbnb (gobnb / pybnb)

Récupère un maximum d’informations sur une annonce Airbnb et les enregistre en JSON.

Basé sur [pybnb](https://github.com/johnbalvin/pybnb) / [gobnb](https://pypi.org/project/gobnb/).

## Installation

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Utilisation

```powershell
# Annonce par URL (données détaillées, sans prix par date)
python airbnb_scraper.py "https://www.airbnb.com/rooms/639705836870039306" -o annonce.json

# Avec dates pour inclure les prix
python airbnb_scraper.py "https://www.airbnb.com/rooms/639705836870039306" --check-in 2025-06-28 --check-out 2025-07-03 -o annonce.json

# Par room_id, devise USD
python airbnb_scraper.py 639705836870039306 -c USD -o annonce.json
```

### Options

| Option | Description |
|--------|-------------|
| `url` | URL de l’annonce ou room_id |
| `-o`, `--output` | Fichier JSON de sortie (défaut: `annonce.json`) |
| `-c`, `--currency` | Code devise (défaut: EUR) |
| `--check-in` | Date d’arrivée (YYYY-MM-DD) pour les prix |
| `--check-out` | Date de départ (YYYY-MM-DD) pour les prix |
| `-p`, `--proxy` | URL proxy optionnelle |

## API HTTP (mode serveur)

Pour intégrer le scraper avec le frontend Indie Host :

```powershell
uvicorn api:app --reload --port 8000
```

Endpoints :

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/health` | Health check |
| POST | `/scrape` | Scrape une annonce (body: `{"url": "https://...", "currency": "EUR"}`) |

Exemple :

```powershell
curl -X POST http://localhost:8000/scrape -H "Content-Type: application/json" -d "{\"url\": \"https://www.airbnb.fr/rooms/47198811\"}"
```

## Compatibilité Airbnb

Si Airbnb modifie sa page, gobnb peut échouer avec une erreur du type `'niobeMinimalClientData'`. Le script tente alors automatiquement de récupérer le JSON embarqué (fallback).

Pour que gobnb fonctionne à nouveau avec la structure actuelle d’Airbnb, le fichier `parse.py` de gobnb a été ajusté pour accepter aussi la clé `niobeClientData`. Si tu recrées le venv, applique ce correctif dans `.venv\Lib\site-packages\gobnb\parse.py` :

- Remplacer la ligne  
  `details_data = data["niobeMinimalClientData"][0][1]`  
  par une boucle qui teste les clés `niobeClientData` puis `niobeMinimalClientData` (comme dans le correctif actuel du projet).
