# IndieHost API (Fastify + Prisma)

Backend REST TypeScript pour le frontend IndieHost.

> Mode standard du projet: lancement via `docker compose` depuis la racine.
> Ce README conserve les infos API et les commandes hors Docker à titre legacy/debug.

## Stack

- Fastify (plugins modulaires)
- Prisma + PostgreSQL
- Clerk JWT (validation via JWKS)
- Stripe Connect (payment intents + onboarding)
- iCal import/export

---

## Démarrage local

### Prérequis

- Node.js ≥ 18
- Docker Desktop (pour PostgreSQL)

### 1. Base de données

```bash
docker compose up -d postgres
```

PostgreSQL écoute sur `localhost:5432`.

### 2. Backend API

```bash
cd backend/api/
cp .env.example .env   # puis renseignez les variables (voir ci-dessous)
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
```

Serveur disponible sur `http://localhost:4000`.

---

## Variables d'environnement (`backend/api/.env`)

```env
NODE_ENV=development
PORT=4000
API_PREFIX=v1
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:5179,http://localhost:3000

DATABASE_URL=postgresql://indiehost:indiehost_dev_password@localhost:5432/indiehost_db?schema=public

# Clerk (optionnel en dev statique)
CLERK_JWKS_URL=https://your-clerk-domain/.well-known/jwks.json
CLERK_ISSUER=https://your-clerk-domain
CLERK_AUDIENCE=

# Stripe (optionnel — mode mock si vide)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_CONNECT_PLATFORM_FEE_BPS=0
STRIPE_CONNECT_DEFAULT_APPLICATION_FEE_BPS=0

# iCal
ICAL_EXPORT_DEFAULT_PRODID=IndieHost//Calendar//FR
```

### Bootstrap des plans Stripe en dev

```bash
cd backend/api
npm run stripe:billing:setup:dev
```

Cette commande crée (ou réutilise) les produits/prix Stripe mensuels en EUR pour `indiehost`, `superhost`, `megahost`.
L’API lit ensuite directement ces produits/prix depuis Stripe (plus besoin de `STRIPE_BILLING_PRICE_*` dans `.env`).

---

## Endpoints

### Listings

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/v1/user/:userId/listings` | Liste des annonces d'un utilisateur |
| `GET` | `/v1/listings/:resource/:listingId` | Lecture d'une ressource |
| `PATCH` | `/v1/listings/:resource/:listingId` | Mise à jour d'une ressource |
| `POST` | `/v1/listings` | Création d'annonce |

### Paiements Stripe

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/v1/payments/stripe/payment-intents` | Création d'un payment intent |
| `POST` | `/v1/payments/stripe/connect/onboarding-link` | Lien d'onboarding Stripe Connect |
| `GET` | `/v1/payments/stripe/connect/me` | Profil Stripe Connect |

### Autres domaines

- `bookings` — réservations et calendrier
- `medias` — gestion des médias
- `arrival` — guide d'arrivée
- `messaging` — messagerie hôte/voyageur
- `users` — profils utilisateurs
- `calendar` → `GET /v1/calendar/listings/:listingId.ics`
- `domains` — rattachement des domaines et sous-domaines gérés côté IndieHost

---

## Auth Clerk

- Les routes privées utilisent `fastify.authenticate`.
- Les routes ouvertes utilisent `fastify.authenticateOptional`.
- Token JWT à envoyer en `Authorization: Bearer <token>`.
- Variables requises pour validation réelle : `CLERK_JWKS_URL`, `CLERK_ISSUER`.

---

## Docker

Le `Dockerfile` lance en production :

```bash
npm run start:docker
```

Ce script fait automatiquement :
1. `prisma generate`
2. `prisma db push`
3. démarrage serveur

Le `docker-compose.yml` (à la racine du projet) expose :
- `api` derrière Nginx via `http://localhost/api/...`
- `postgres:16` comme service interne Docker (`postgres:5432`)
