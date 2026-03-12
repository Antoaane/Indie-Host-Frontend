# IndieHost

Solution SaaS pour hôtes de locations courte durée — réservations directes, paiements intégrés, messagerie, noms de domaine.

---

## Démarrage rapide

### Windows (PowerShell)

```powershell
.\start-indiehost.ps1
```

### macOS / Linux

```bash
chmod +x ./start-indiehost.sh
./start-indiehost.sh
```

Le script lit `frontend/.env` puis adapte les services à démarrer :

| # | Service | URL |
|---|---|---|
| 1 | **PostgreSQL** (Docker) | `localhost:5432` (mode API) |
| 2 | **Backend API** (Fastify) | `http://localhost:4000` |
| 3 | **Scraping** (FastAPI/Python) | `http://localhost:8000` |
| 4 | **Frontend** (Vite/Vue 3) | `http://localhost:5179` |

Le script :
- Détecte `VITE_LISTINGS_DATA_MODE` dans `frontend/.env`
- Vérifie Docker + démarre PostgreSQL uniquement en mode `api`
- Démarre le Backend API dans un terminal dédié (mode `api` et `local-json`)
- Ouvre un terminal dédié par service (Windows Terminal si disponible, PowerShell sinon)
- Détecte les ports déjà occupés pour éviter les doublons

---

## Prérequis

- [Node.js ≥ 18](https://nodejs.org)
- [Python 3.10+](https://www.python.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (mode API uniquement)
- [Git](https://git-scm.com)

---

## Structure

```
IndieHost/
├── frontend/               # Vite + Vue 3 + TypeScript
├── backend/
│   ├── api/                # Fastify + Prisma + PostgreSQL
│   └── microservices/
│       └── microservice-scraping-py/   # FastAPI scraping Airbnb/Booking
├── docker/
│   └── docker-compose.yml  # PostgreSQL + pgAdmin
├── start-indiehost.ps1     # ← Démarrage Windows
├── start-indiehost.sh      # ← Démarrage macOS/Linux
└── README.md
```

---

## Premier lancement (configuration initiale)

### 1. Variables d'environnement

```powershell
# Backend API
Copy-Item backend\api\.env.example backend\api\.env

# Frontend
Copy-Item frontend\.env.example frontend\.env
```

Éditer `backend/api/.env` :

```env
DATABASE_URL=postgresql://indiehost:indiehost_dev_password@localhost:5432/indiehost_db?schema=public

# Gandi.net — disponibilité et achat de noms de domaine
# Générez un PAT sur https://account.gandi.net → Sécurité → Personal Access Tokens
# Scope requis : domain:read
GRANDI_API_TOKEN=pat_votre-token-gandi
```

Éditer `frontend/.env` :

```env
VITE_LISTINGS_DATA_MODE=local-json
# VITE_LISTINGS_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:4000/v1
```

### 2. Installation des dépendances

```powershell
# Backend
cd backend\api
npm install
npm run prisma:generate
npm run prisma:push

# Frontend
cd frontend
npm install

# Scraping (Python)
cd backend\microservices\microservice-scraping-py
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Démarrer

```powershell
.\start-indiehost.ps1
```

---

## Fonctionnalités principales

- **Éditeur d'annonces** — import Airbnb/Booking, galerie, tarifs, calendrier
- **Gestion des réservations** — planning, paiements manuels + Stripe
- **Messagerie** hôte/voyageur
- **Guide d'arrivée** (PWA via QR code)
- **DomainPanel** — vérification de disponibilité et achat de noms de domaine via [Gandi.net](https://www.gandi.net)
- **Paiements** — Stripe Connect, acomptes, espèces

---

## Documentation détaillée

- [`frontend/README.md`](./frontend/README.md) — Frontend Vite/Vue 3
- [`backend/api/README.md`](./backend/api/README.md) — API Fastify, endpoints, variables d'env
- [`backend/microservices/microservice-scraping-py/README.md`](./backend/microservices/microservice-scraping-py/README.md) — Scraper Airbnb/Booking
