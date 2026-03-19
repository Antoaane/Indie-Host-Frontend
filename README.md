# IndieHost

Solution SaaS pour hôtes de locations courte durée: réservations directes, paiements intégrés, messagerie, domaines et import d'annonce (scraping Airbnb/Booking).

## Docker-Only (mode standard)

Le projet se lance uniquement via Docker Compose.

## 1) Initialiser les fichiers locaux

Linux/macOS:

```bash
./init-indiehost.sh
```

Windows PowerShell:

```powershell
./init-indiehost.ps1
```

Cette étape crée (si absents):
- `/.env`
- `/secrets/*.txt`

## 2) Renseigner les valeurs réelles

Modifier:
- `/.env`
- `/secrets/database_url.txt`
- `/secrets/stripe_secret_key.txt`
- `/secrets/clerk_secret_key.txt`
- `/secrets/imagekit_api_key.txt`

Par défaut `STRICT_EXTERNAL_CONFIG=true` dans `.env`: le démarrage échoue si Stripe/Clerk/ImageKit ne sont pas configurés.

## 3) Lancer et attendre que tout soit prêt

Linux/macOS:

```bash
./start-indiehost.sh
```

Windows PowerShell:

```powershell
./start-indiehost.ps1
```

Commande Docker équivalente:

```bash
docker compose up -d --build --wait
```

## 4) Vérifier

- Frontend: `http://localhost`
- API health: `http://localhost/api/health`
- Scraping health: `http://localhost/scraping/health`
- PostgreSQL interne: `postgres:5432`

## Mode Dev (hot reload)

Le mode dev garde PostgreSQL + API + scraping + reverse proxy, avec:
- `frontend` via Vite (`:5179`, HMR actif)
- `api` via `tsx watch`
- `scraping` via `uvicorn --reload`

Linux/macOS:

```bash
./start-indiehost-dev.sh
```

Windows PowerShell:

```powershell
./start-indiehost-dev.ps1
```

Commande Docker équivalente:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

URLs utiles en dev:
- via Nginx: `http://localhost`
- Vite direct: `http://localhost:5179`
- API health: `http://localhost/api/health`
- scraping health: `http://localhost/scraping/health`

## Arborescence utile

```text
.
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── secret.example/   # templates versionnés
├── secrets/          # secrets locaux runtime (non versionnés)
├── frontend/
├── backend/api/
├── backend/microservices/microservice-scraping-py/
├── nginx/
├── init-indiehost.sh
├── init-indiehost.ps1
├── start-indiehost.sh
├── start-indiehost.ps1
├── start-indiehost-dev.sh
└── start-indiehost-dev.ps1
```

## Notes

- Les variables frontend `VITE_*` sont injectées au build Docker via `docker-compose.yml`.
- Les secrets backend principaux passent par des fichiers (`*_FILE`) montés depuis `secrets/*.txt`.
- Les clés optionnelles peuvent rester en variables d'environnement (`STRIPE_WEBHOOK_SECRET`, `SCRAPFLY_KEY`, `GANDI_API_TOKEN`).
- Le microservice scraping est exposé via Nginx sur `/scraping/`.
