# IndieHost

Plateforme SaaS pour hôtes de locations courte durée:
- site de réservation directe
- paiements Stripe
- messagerie
- domaines
- import d'annonces Airbnb/Booking via microservice scraping

Le projet fonctionne en **Docker-only**.

## Prérequis

- Docker Desktop (ou Docker Engine + Compose v2)
- Port `80` libre

## TL;DR

Mode standard:

```bash
./start-indiehost.sh
```

Mode dev (hot reload):

```bash
./start-indiehost-dev.sh
```

Sous PowerShell, utilise les versions `.ps1`.

## Arborescence clé

```text
.
├── docker-compose.yml                # stack standard (prod-like local)
├── docker-compose.dev.yml            # override dev (hot reload)
├── .env.example
├── secret.example/                   # templates versionnés
├── secrets/                          # secrets locaux runtime (non versionnés)
├── nginx/
├── frontend/
├── backend/api/
├── backend/microservices/microservice-scraping-py/
├── init-indiehost.sh(.ps1)
├── start-indiehost.sh(.ps1)
└── start-indiehost-dev.sh(.ps1)
```

## Initialisation (une seule fois par machine)

Linux/macOS:

```bash
./init-indiehost.sh
```

Windows PowerShell:

```powershell
./init-indiehost.ps1
```

Cette commande crée, si absents:
- `/.env`
- `/secrets/database_url.txt`
- `/secrets/stripe_secret_key.txt`
- `/secrets/clerk_secret_key.txt`
- `/secrets/imagekit_api_key.txt`
- `/secrets/cloudflare.ini` (template wildcard HTTPS Cloudflare)

## Mode Standard (stack stable)

### Lancer

Linux/macOS:

```bash
./start-indiehost.sh
```

Windows PowerShell:

```powershell
./start-indiehost.ps1
```

Commande équivalente:

```bash
docker compose up -d --build --wait
```

### URLs

- App: `http://localhost`
- API health: `http://localhost/api/health`
- Scraping health: `http://localhost/scraping/health`

### Comportement de validation

Le service `preflight` vérifie la config avant de démarrer la stack:
- `STRICT_EXTERNAL_CONFIG=true` (par défaut): configuration externe stricte (Clerk/Stripe/ImageKit)
- `STRICT_EXTERNAL_CONFIG=false`: mode plus permissif (utile en dev local)

## Mode Dev (hot reload complet)

Le mode dev garde la même architecture globale (nginx + api + scraping + postgres) avec:
- frontend en **Vite dev server** (`HMR`)
- api en `tsx watch`
- scraping en `uvicorn --reload`
- watcher frontend en polling (compatible Docker Desktop + Windows)

### Lancer

Linux/macOS:

```bash
./start-indiehost-dev.sh
```

Windows PowerShell:

```powershell
./start-indiehost-dev.ps1
```

Commande équivalente:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

### URLs

- App via nginx: `http://localhost`
- Vite direct: `http://localhost:5179`
- API health: `http://localhost/api/health`
- Scraping health: `http://localhost/scraping/health`

## Variables et secrets

### Obligatoires pour démarrer

- `.env` (copié depuis `.env.example`)
- `secrets/database_url.txt`

### Recommandés / selon fonctionnalités

- `secrets/stripe_secret_key.txt`
- `secrets/clerk_secret_key.txt`
- `secrets/imagekit_api_key.txt`

### Optionnels (env direct)

- `STRIPE_WEBHOOK_SECRET`
- `SCRAPFLY_KEY`
- `GANDI_API_TOKEN`

Templates disponibles dans `secret.example/`.

## HTTPS wildcard Cloudflare (`*.indiehost.fr`)

La stack standard est préparée pour certbot DNS Cloudflare.

### Manuel (une seule fois)

1. Éditer `secrets/cloudflare.ini` avec un token Cloudflare DNS Zone:

```ini
dns_cloudflare_api_token = <token_cloudflare_dns>
```

2. Vérifier les DNS Cloudflare:
- `A indiehost.fr -> IP serveur`
- `A *.indiehost.fr -> IP serveur`

3. Générer le certificat wildcard initial:

```bash
docker compose run --rm --entrypoint certbot certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /run/secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds ${CLOUDFLARE_DNS_PROPAGATION_SECONDS:-30} \
  -d indiehost.fr \
  -d "*.indiehost.fr" \
  --email "${SSL_EMAIL}" \
  --agree-tos --no-eff-email
```

4. Relancer la stack:

```bash
docker compose up -d --build --wait
```

### Renouvellement automatique

- Service `certbot` tourne en boucle (`renew` toutes les 12h).
- Nginx recharge sa conf/cert toutes les 12h.
- Le certificat doit donc se renouveler automatiquement tant que `secrets/cloudflare.ini` reste présent et valide.

## Commandes utiles

Démarrer standard:

```bash
docker compose up -d --build --wait
```

Démarrer dev:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

Arrêter:

```bash
docker compose down
```

Arrêter dev:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

Voir l'état:

```bash
docker compose ps
```

Logs d'un service:

```bash
docker compose logs -f api
```

Logs en mode dev:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend
```

## Dépannage rapide

### `preflight` en échec

- Vérifie `.env` + `secrets/*.txt`
- Lance:

```bash
docker compose run --rm preflight
```

### `api` redémarre en boucle en mode dev

- Relance propre:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

### Le frontend ne hot-reload pas

- Vérifie que tu modifies bien les fichiers du même dossier que celui utilisé par `docker compose`
- Regarde les logs frontend:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend
```
