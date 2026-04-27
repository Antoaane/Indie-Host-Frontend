# IndieHost

Plateforme SaaS pour hôtes de locations courte durée:
- site de réservation directe
- paiements Stripe
- messagerie
- domaines

Le projet fonctionne en **Docker-only**.

## Prérequis

- Docker Desktop (ou Docker Engine + Compose v2)
- Port `80` libre

## TL;DR

Mode prod Docker:

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
├── docker-compose.yml                # stack prod Docker
├── docker-compose.dev.yml            # override dev (hot reload)
├── .env.example
├── secret.example/                   # templates versionnés
├── secrets/                          # secrets locaux runtime (non versionnés)
├── nginx/
├── frontend/
├── backend/api/
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

## Mode Prod Docker

Avant le premier lancement, renseigner `.env` et les fichiers `secrets/*.txt` avec de vraies valeurs de production. Avec `STRICT_EXTERNAL_CONFIG=true`, le preflight refuse notamment `NODE_ENV` différent de `production`, les domaines `localhost`, et les secrets externes vides.

### Lancer

Linux/macOS:

```bash
./start-indiehost.sh
```

Windows PowerShell:

```powershell
./start-indiehost.ps1
```

Le script lance le preflight, génère le certificat wildcard Cloudflare initial si absent, exécute les migrations Prisma via le service `migrate`, puis démarre la stack.

### URLs

- App: `https://<SSL_DOMAIN>`
- API health: `https://<SSL_DOMAIN>/api/health`

### Comportement de validation

Le service `preflight` vérifie la config avant de démarrer la stack:
- `STRICT_EXTERNAL_CONFIG=true` (par défaut): configuration externe stricte (Clerk/Stripe/ImageKit/Cloudflare + valeurs de prod)
- `STRICT_EXTERNAL_CONFIG=false`: mode plus permissif (utile en dev local)

## Mode Dev (hot reload complet)

Le mode dev garde la même architecture globale (nginx + api + postgres) avec:
- frontend en **Vite dev server** (`HMR`)
- api en `tsx watch`
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

## Variables et secrets

### Obligatoires pour démarrer

- `.env` (copié depuis `.env.example`)
- `secrets/database_url.txt`

### Recommandés / selon fonctionnalités

- `secrets/stripe_secret_key.txt`
- `secrets/clerk_secret_key.txt`
- `secrets/imagekit_api_key.txt`

Templates disponibles dans `secret.example/`.

## HTTPS wildcard Cloudflare (`*.indiehost.fr`)

La stack standard est préparée pour certbot DNS Cloudflare.

### Configuration

1. Éditer `secrets/cloudflare.ini` avec un token Cloudflare DNS Zone:

```ini
dns_cloudflare_api_token = <token_cloudflare_dns>
```

2. Vérifier les DNS Cloudflare:
- `A indiehost.fr -> IP serveur`
- `A *.indiehost.fr -> IP serveur`

3. Lancer le script prod:

```bash
./start-indiehost.sh
```

Le certificat initial est créé automatiquement si `certbot/conf/live/<SSL_DOMAIN>/fullchain.pem` est absent.

### Renouvellement automatique

- Service `certbot` tourne en boucle (`renew` toutes les 12h).
- Nginx recharge sa conf/cert toutes les 12h.
- Le certificat doit donc se renouveler automatiquement tant que `secrets/cloudflare.ini` reste présent et valide.

## Commandes utiles

Démarrer prod avec preflight + certificat initial:

```bash
./start-indiehost.sh
```

Démarrer la stack sans bootstrap de certificat:

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
