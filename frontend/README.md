<!-- File: README.md -->

# IndieHost Frontend

Vite + Vue 3 + TypeScript — interface hôte pour la gestion d'annonces, réservations, messagerie et noms de domaine.

> Mode standard du projet: lancement via `docker compose` depuis la racine.
> Ce README documente le frontend et conserve le mode Vite local à titre legacy/debug.

---

## Architecture — Services à lancer

Le frontend fonctionne en **mode API**.

| # | Service | Commande | Port | Requis |
|---|---|---|---|---|
| 1 | **PostgreSQL** (Docker) | `docker compose up -d postgres` | `5432` | ✅ Obligatoire |
| 2 | **Backend API** (Fastify) | `npm run dev` dans `backend/api/` | `4000` | ✅ Obligatoire |
| 3 | **Frontend** (Vite) | `npm run dev` dans `frontend/` | `5179` | ✅ Obligatoire |

---

## Démarrage (mode API)

### 1. PostgreSQL via Docker

```bash
docker compose up -d postgres
```

### 2. Backend API

```bash
cd backend/api/
cp .env.example .env
# → Renseignez DATABASE_URL et les clés externes nécessaires.
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
VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX

VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX
VITE_STRIPE_API_BASE_URL=http://localhost:4000/v1
VITE_STRIPE_PAYMENT_INTENT_PATH=/payments/stripe/payment-intents
VITE_STRIPE_PAYMENT_RETURN_URL=http://localhost:5179
VITE_STRIPE_CHECKOUT_OFFLINE_MODE=false
```

> En mode API, Vite proxifie automatiquement `/api/v1/*` vers `http://localhost:4000/v1/*`. Les requêtes apparaissent sous `localhost:5179/api/v1/...` dans le Network — c'est normal.

---

## Variables d'environnement backend (`backend/api/.env`)

```env
DATABASE_URL=postgresql://indiehost:indiehost_dev_password@localhost:5432/indiehost_db?schema=public
```

---

## Fonctionnalités

### DomainPanel (sidebar éditeur)

Le `DomainPanel` est intégré dans la sidebar de l'éditeur, juste sous "Titre de l'annonce".
Il expose les informations de sous-domaine et de domaine rattachées à l'annonce via l'API IndieHost.

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
