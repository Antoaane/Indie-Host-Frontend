<!-- File: README.md -->

# IndieHost Frontend

Vite + Vue 3 + TypeScript — interface hôte pour la gestion d'annonces, réservations, messagerie et noms de domaine.

---

## Architecture — Services à lancer

Le projet peut tourner en **mode local-json** (sans API) ou en **mode API** :

| # | Service | Commande | Port | Requis |
|---|---|---|---|---|
| 1 | **PostgreSQL** (Docker) | `docker compose up -d postgres` | `5432` | ✅ Obligatoire (mode API) |
| 2 | **Backend API** (Fastify) | `npm run dev` dans `backend/api/` | `4000` | ✅ Obligatoire (mode API) |
| 3 | **Frontend** (Vite) | `npm run dev` dans `frontend/` | `5179` | ✅ Obligatoire |

> Le microservice scraping Python (`backend/microservices/`) est optionnel — uniquement pour l'import d'annonces Airbnb/Booking.

---

## Démarrage (mode API)

### 1. PostgreSQL via Docker

```bash
cd docker/
docker compose up -d postgres
```

### 2. Backend API

```bash
cd backend/api/
cp .env.example .env
# → Renseignez DATABASE_URL, GANDI_API_TOKEN, etc.
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
# → http://localhost:4000
```

### 3. Frontend

```powershell
# Windows (PowerShell)
cd frontend/
Copy-Item .env.example .env
# → Pour le mode API, utilisez VITE_LISTINGS_DATA_MODE=api
npm install
npm run dev
# → http://localhost:5179
```

```bash
# macOS / Linux
cd frontend/
cp .env.example .env
npm install
npm run dev
```

---

## Variables d'environnement frontend (`frontend/.env`)

```env
VITE_LISTINGS_DATA_MODE=local-json
# VITE_LISTINGS_DATA_MODE=api
# VITE_API_BASE_URL=http://localhost:4000/v1

VITE_SCRAPING_API_URL=http://localhost:8000

VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX

VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX
VITE_STRIPE_API_BASE_URL=http://localhost:4000/v1
VITE_STRIPE_PAYMENT_INTENT_PATH=/payments/stripe/payment-intents
VITE_STRIPE_PAYMENT_RETURN_URL=http://localhost:5179
VITE_STRIPE_CHECKOUT_OFFLINE_MODE=false
```

> En mode API, Vite proxifie automatiquement `/v1/*` vers `http://localhost:4000`. Les requêtes apparaissent sous `localhost:5179/v1/...` dans le Network — c'est normal.

---

## Variables d'environnement backend (`backend/api/.env`)

```env
DATABASE_URL=postgresql://indiehost:indiehost_dev_password@localhost:5432/indiehost_db?schema=public

# Gandi.net — noms de domaine (DomainPanel)
# Générez un PAT sur https://account.gandi.net → Sécurité → Personal Access Tokens
# Scope requis : domain:read
GANDI_API_TOKEN=pat_votre-token-gandi
GANDI_API_BASE_URL=https://api.gandi.net/v5
GANDI_CHECKOUT_BASE_URL=https://www.gandi.net/en/domain/checkout
```

---

## Fonctionnalités

### DomainPanel (sidebar éditeur)

Le `DomainPanel` est intégré dans la sidebar de l'éditeur, juste sous "Titre de l'annonce".
Il permet de :
1. **Vérifier la disponibilité** d'un nom de domaine via l'API Gandi v5
2. **Lancer le paiement** — redirige vers la page d'achat Gandi pré-remplie

**Backend requis :** `GET /v1/domains/grandi/availability` et `POST /v1/domains/grandi/checkout`
**Token requis :** Personal Access Token Gandi avec le scope `domain:read`

---

## Scripts utiles

```bash
npm run dev         # Lance Vite (5179)
npm run build       # type-check + build production
npm run type-check  # vue-tsc --build
npm run format      # Prettier sur src/
npm run tag:files   # Synchronise les entêtes "File: <path>"
npm run svg:convert # Convertisseur SVG → composants Vue
npm run watch       # SASS input.scss → output.css
```

---

## Plugins internes

- **file-path-comment** : ajoute/synchronise la première ligne `// File: <path>` dans chaque fichier source.
- **svg-to-vue** : convertit les SVG de `public/assets/media/` en composants Vue SFC avec bindings a11y.
- **local-json-data** : expose les fichiers JSON de `src/content/` via `/__local-json/*` (mode statique sans backend).
