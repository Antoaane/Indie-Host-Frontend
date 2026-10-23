# Microservice de Scraping IndieHost

Microservice Python stateless expose via FastAPI pour importer des annonces **Airbnb** et **Booking.com** dans IndieHost.

Il sert a :
- normaliser les URL partagees ou mobiles
- recuperer un maximum de donnees de l'annonce
- enrichir les champs utiles au frontend IndieHost
- retourner un payload JSON unique via `POST /scrape`

## Sources supportees

- `airbnb.* /rooms/...`
- `booking.com/hotel/...`

## Fonctionnalites actuelles

### Airbnb

Le scraper Airbnb combine plusieurs niveaux :
- extraction principale via `gobnb`
- enrichissement HTML / JSON-LD / donnees embarquees
- ouverture des modals description / equipements via Playwright quand necessaire
- mapping des amenities Airbnb vers le catalogue IndieHost via `airbnb_amenity_mapping.py`

Champs generalement retournes :
- `title`
- `description`
- `price`
- `average_rating`
- `review_count`
- `coordinates`
- `precise_address`
- `city`
- `region`
- `country`
- `person_capacity`
- `room_type`
- `overview_items`
- `room_counts`
- `highlight_titles`
- `amenities`
- `amenities_indiehost`
- `images`
- `house_rules`
- `location_descriptions`

### Booking.com

Le scraper Booking suit maintenant une logique plus proche d'Airbnb :
- tentative 1 : `ScrapFly` si `SCRAPFLY_KEY` est configuree
- tentative 2 : `Playwright`
- tentative 3 : `curl_cffi`

Le parsing Booking a ete enrichi pour extraire :
- `title`
- `description`
- `price`
- `average_rating`
- `review_count`
- `coordinates`
- `precise_address`
- `city`
- `region`
- `country`
- `person_capacity`
- `room_type`
- `overview_items`
- `room_counts`
- `amenities`
- `images`
- `house_rules`
- `location_descriptions`

## Arborescence utile

- `api.py`
- `airbnb_scraper.py`
- `booking_scraper.py`
- `requirements.txt`

## Installation

### macOS / Linux

```bash
cd backend/microservices/microservice-scraping-py
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m playwright install chromium
```

### Windows PowerShell

```powershell
cd backend/microservices/microservice-scraping-py
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m playwright install chromium
```

### Depannage Windows (`KeyboardInterrupt` pendant `python -m venv`)

Si la creation du venv se bloque dans `_setup_pip` puis finit en `KeyboardInterrupt`, le plus fiable est de creer le venv sans pip, puis d'installer pip manuellement :

```powershell
cd backend/microservices/microservice-scraping-py
if (Test-Path .venv) { Remove-Item -Recurse -Force .venv }

py -3.11 -m venv .venv --without-pip
.\.venv\Scripts\python.exe -m ensurepip --upgrade
.\.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Si l'activation PowerShell est bloquee, utiliser :

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

## Variables d'environnement

Le service charge automatiquement un `.env` si disponible.

Variables utiles :

| Variable | Description | Obligatoire |
|---|---|---|
| `SCRAPFLY_KEY` | Cle API ScrapFly pour fiabiliser le scraping Booking | Non |
| `SCRAPFLY_KEY_FILE` | Chemin fichier secret Docker contenant `SCRAPFLY_KEY` | Non |
| `PLAYWRIGHT_BROWSERS_PATH` | Chemin des navigateurs Playwright. Le scraper force deja `0` par defaut pour Airbnb | Non |

Notes :
- `SCRAPFLY_KEY` est surtout utile pour Booking, qui est plus agressif cote anti-bot.
- Sans `SCRAPFLY_KEY`, Booking retombe sur Playwright puis `curl_cffi`.

## Lancer l'API HTTP

```bash
cd backend/microservices/microservice-scraping-py
uvicorn api:app --reload --port 8000
```

### Lancement Docker (compose)

Le service est lance automatiquement par `docker-compose.yml`.

Healthcheck:
- `GET /health`

Endpoints :

| Methode | URL | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/scrape` | Scrape une annonce Airbnb ou Booking |

Exemple reponse health :

```json
{
  "status": "ok",
  "service": "indiehost-scraping"
}
```

## Requete `/scrape`

Exemple minimal :

```json
{
  "url": "https://www.airbnb.fr/rooms/47198811"
}
```

Schema supporte :

```json
{
  "url": "https://www.airbnb.fr/rooms/47198811",
  "currency": "EUR",
  "check_in": "2026-04-10",
  "check_out": "2026-04-14",
  "proxy_url": ""
}
```

Signification des champs :

| Champ | Description |
|---|---|
| `url` | URL de l'annonce Airbnb ou Booking |
| `currency` | Devise demandee, surtout utile pour Airbnb |
| `check_in` | Date d'arrivee `YYYY-MM-DD` |
| `check_out` | Date de depart `YYYY-MM-DD` |
| `proxy_url` | Proxy HTTP/HTTPS optionnel |

## Exemples `curl`

### Airbnb

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.airbnb.fr/rooms/47198811",
    "currency": "EUR"
  }'
```

### Booking.com

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.booking.com/hotel/fr/xxx.html"
  }'
```

## Exemples de sortie

Le payload exact depend de la source et de ce que la page expose, mais le contrat ressemble a ceci :

```json
{
  "listing_url": "https://www.booking.com/hotel/fr/xxx.html",
  "source": "booking",
  "title": "Nom de l'annonce",
  "description": "Description longue...",
  "price": 189,
  "average_rating": 8.6,
  "review_count": 248,
  "coordinates": {
    "latitude": 48.8566,
    "longitude": 2.3522
  },
  "precise_address": "12 Rue Exemple, Paris, Ile-de-France, France",
  "city": "Paris",
  "region": "Ile-de-France",
  "country": "France",
  "overview_items": [
    "4 guests",
    "2 bedrooms",
    "3 beds"
  ],
  "room_counts": {
    "guest_capacity": 4,
    "bedrooms": 2,
    "beds": 3
  },
  "amenities": [
    {
      "title": "Equipements",
      "values": [
        {
          "title": "Wi-Fi gratuit",
          "available": true
        }
      ]
    }
  ],
  "images": [
    {
      "title": "Légende fournie par la plateforme, sinon vide",
      "url": "https://..."
    }
  ],
  "house_rules": {
    "general": [
      {
        "title": "Arrivee",
        "values": [
          {
            "title": "Check-in de 15:00 a 22:00"
          }
        ]
      }
    ]
  },
  "person_capacity": 4,
  "room_type": "Apartment",
  "location_descriptions": [
    {
      "title": "12 Rue Exemple, Paris, Ile-de-France, France",
      "content": ""
    }
  ]
}
```

## Utilisation en CLI

### Airbnb

Le scraper Airbnb peut aussi etre lance directement :

```bash
python airbnb_scraper.py "https://www.airbnb.com/rooms/639705836870039306" -o annonce.json
python airbnb_scraper.py "https://www.airbnb.com/rooms/639705836870039306" --check-in 2026-04-10 --check-out 2026-04-14 -o annonce.json
python airbnb_scraper.py 639705836870039306 -c USD -o annonce.json
```

Options principales :

| Option | Description |
|---|---|
| `url` | URL Airbnb ou `room_id` |
| `-o`, `--output` | Fichier JSON de sortie |
| `-c`, `--currency` | Code devise |
| `--check-in` | Date d'arrivee |
| `--check-out` | Date de depart |
| `-p`, `--proxy` | Proxy optionnel |
| `-b`, `--batch-file` | Fichier batch pour traitement sequentiel |

### Booking

Le scraper Booking est actuellement pense avant tout pour l'API et l'import frontend.
Le point d'entree principal est `scrape_listing()` dans `booking_scraper.py`.

## Comportements importants

### Normalisation des URL

L'API normalise automatiquement :
- les liens Airbnb mobiles ou sans protocole
- les liens Booking `booking.com/hotel/...` avec ou sans `https://`

### Retries API

Le endpoint `/scrape` applique une petite logique de retry sur certaines erreurs bas niveau, notamment les `Broken pipe`, avant de renvoyer une `422`.

### Booking et anti-bot

Si Booking bloque completement la requete, le microservice renvoie un message metier explicite :
- essayer avec `SCRAPFLY_KEY`
- ou repasser sur un import Airbnb
- ou saisir manuellement les informations

### Mapping des amenities

- Airbnb : mapping backend vers le catalogue IndieHost disponible
- Booking : le microservice renvoie des amenities structurees ; le filtrage final vers le catalogue IndieHost est complete ensuite par le frontend

## Validation rapide

Verifier la syntaxe Python :

```bash
python3 -m py_compile api.py airbnb_scraper.py booking_scraper.py
```

Verifier l'API :

```bash
curl http://localhost:8000/health
```

## Depannage

### `SCRAPFLY_KEY non definie`

Normal si tu n'utilises pas ScrapFly. Booking basculera vers Playwright puis `curl_cffi`.

### `beautifulsoup4 requis`

Installer les dependances :

```bash
python -m pip install -r requirements.txt
```

### Playwright ne trouve pas Chromium

Executer :

```bash
python -m playwright install chromium
```

### Airbnb casse cote `gobnb`

Si Airbnb change sa structure, `gobnb` peut casser avant fallback. Le scraper tente deja un fallback HTML/JSON embarque, mais si tu recrees completement l'environnement il peut etre utile de verifier la compatibilite de la version `gobnb` installee avec la structure actuelle d'Airbnb.
