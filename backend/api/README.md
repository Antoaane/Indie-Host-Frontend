# IndieHost API (Fastify + Prisma)

Backend REST TypeScript pour le frontend IndieHost.

## Stack

- Fastify (plugins modulaires)
- Prisma + PostgreSQL
- Clerk JWT (validation via JWKS)
- Stripe Connect (payment intents + onboarding)
- iCal import/export
- **Gandi.net API v5** (disponibilité + checkout noms de domaine)

---

## Démarrage local

### Prérequis

- Node.js ≥ 18
- Docker Desktop (pour PostgreSQL)

### 1. Base de données

```bash
cd docker/
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
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CONNECT_PLATFORM_FEE_BPS=0
STRIPE_CONNECT_DEFAULT_APPLICATION_FEE_BPS=0

# iCal
ICAL_EXPORT_DEFAULT_PRODID=IndieHost//Calendar//FR

# Gandi.net — noms de domaine
# Générez un Personal Access Token sur https://account.gandi.net
#   → Sécurité → Personal Access Tokens → Créer
#   → Scope requis : domain:read
GRANDI_API_TOKEN=pat_votre-token-gandi
GRANDI_API_BASE_URL=https://api.gandi.net/v5
GRANDI_CHECKOUT_BASE_URL=https://www.gandi.net/en/domain/checkout
```

> **Important Gandi** : utilisez un **Personal Access Token** (PAT) depuis votre compte Gandi.net.
> Les anciennes clés API (`Apikey`) sont dépréciées et peuvent retourner des erreurs 403.

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

### Noms de domaine (Gandi)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/v1/domains/grandi/availability?domain=<fqdn>` | Disponibilité + prix TTC (1 an) |
| `POST` | `/v1/domains/grandi/checkout` | URL de paiement Gandi pré-remplie |

**Exemple disponibilité :**
```bash
curl "http://localhost:4000/v1/domains/grandi/availability?domain=mon-gite.fr" \
  -H "Authorization: Bearer <clerk-token>"
```

**Réponse :**
```json
{
  "domain": "mon-gite.fr",
  "available": true,
  "premium": false,
  "priceCents": 1499,
  "currency": "EUR",
  "reason": null
}
```

**Exemple checkout :**
```bash
curl -X POST "http://localhost:4000/v1/domains/grandi/checkout" \
  -H "Content-Type: application/json" \
  -d '{ "domain": "mon-gite.fr" }'
```

**Réponse :**
```json
{
  "id": "grandi_lx3k2a_a8f3c1",
  "checkoutUrl": "https://www.gandi.net/en/domain/checkout?domain=mon-gite.fr"
}
```

### Autres domaines

- `bookings` — réservations et calendrier
- `medias` — gestion des médias
- `arrival` — guide d'arrivée
- `messaging` — messagerie hôte/voyageur
- `users` — profils utilisateurs
- `calendar` → `GET /v1/calendar/listings/:listingId.ics`

---

## Auth Clerk

- Les routes privées utilisent `fastify.authenticate`.
- Les routes ouvertes utilisent `fastify.authenticateOptional` (Gandi inclus).
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

Le `docker-compose.yml` (dans `docker/`) expose :
- `postgres:16` sur `:5432`
- `backend-api` sur `:4000`
- `pgadmin` sur `:5050` (admin@indiehost.fr / admin)
