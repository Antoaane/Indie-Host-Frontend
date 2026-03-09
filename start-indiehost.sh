#!/usr/bin/env bash
# ============================================================
# IndieHost — Démarrage complet de tous les services
# Usage : ./start-indiehost.sh
# ============================================================

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${CYAN}▶  $1${NC}"; }
ok()   { echo -e "   ${GREEN}✔  $1${NC}"; }
warn() { echo -e "   ${YELLOW}⚠  $1${NC}"; }
fail() { echo -e "   ${RED}✘  $1${NC}"; exit 1; }

port_in_use() { lsof -i ":$1" -sTCP:LISTEN -t &>/dev/null; }

# ── 1. Docker ─────────────────────────────────────────────────
step "Vérification de Docker..."
if ! docker info &>/dev/null; then
    fail "Docker n'est pas démarré. Lance Docker Desktop puis relance ce script."
fi
ok "Docker actif."

# ── 2. PostgreSQL ─────────────────────────────────────────────
step "Démarrage de PostgreSQL..."
PG_RUNNING=$(docker ps --filter "name=indiehost-postgres" --filter "status=running" -q)
if [ -n "$PG_RUNNING" ]; then
    ok "PostgreSQL déjà actif (localhost:5432)."
else
    (cd "$ROOT/docker" && docker compose up -d postgres)
    sleep 2
    ok "PostgreSQL démarré (localhost:5432)."
fi

# ── 3. Backend API (:4000) ────────────────────────────────────
step "Démarrage du Backend API..."
if port_in_use 4000; then
    ok "Backend API déjà actif (localhost:4000)."
else
    cd "$ROOT/backend/api" && npm run dev &
    ok "Backend API démarré en arrière-plan (localhost:4000)."
fi

# ── 4. Scraping (:8000) ───────────────────────────────────────
step "Démarrage du serveur de scraping..."
if port_in_use 8000; then
    ok "Serveur de scraping déjà actif (localhost:8000)."
else
    PYTHON="$ROOT/backend/microservices/microservice-scraping-py/.venv/bin/python"
    cd "$ROOT/backend/microservices/microservice-scraping-py" && "$PYTHON" -m uvicorn api:app --reload --port 8000 &
    ok "Serveur de scraping démarré en arrière-plan (localhost:8000)."
fi

# ── 5. Frontend (:5179) ───────────────────────────────────────
step "Démarrage du Frontend..."
if port_in_use 5179; then
    ok "Frontend déjà actif (localhost:5179)."
else
    cd "$ROOT/frontend" && npm run dev &
    ok "Frontend démarré en arrière-plan (localhost:5179)."
fi

# ── Récap ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${NC}  IndieHost — Tous les services actifs  ${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo "  PostgreSQL  localhost:5432"
echo "  API         http://localhost:4000"
echo "  Scraping    http://localhost:8000"
echo "  Frontend    http://localhost:5179"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo ""

wait
