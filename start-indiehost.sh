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
open_service_terminal() {
    local title="$1"
    local workdir="$2"
    local service_cmd="$3"
    local boot_cmd

    printf -v boot_cmd 'cd %q && %s' "$workdir" "$service_cmd"

    if [ -n "${WSL_DISTRO_NAME:-}" ] && command -v wt.exe &>/dev/null; then
        wt.exe -w 0 new-tab --title "$title" wsl.exe -d "$WSL_DISTRO_NAME" bash -lc "$boot_cmd; exec bash" >/dev/null 2>&1 &
        return 0
    fi

    if command -v gnome-terminal &>/dev/null; then
        gnome-terminal --title="$title" -- bash -lc "$boot_cmd; exec bash" >/dev/null 2>&1 &
        return 0
    fi

    if command -v x-terminal-emulator &>/dev/null; then
        x-terminal-emulator -e bash -lc "$boot_cmd; exec bash" >/dev/null 2>&1 &
        return 0
    fi

    if command -v konsole &>/dev/null; then
        konsole --new-tab -p tabtitle="$title" -e bash -lc "$boot_cmd; exec bash" >/dev/null 2>&1 &
        return 0
    fi

    return 1
}

python_module_available() {
    local python_exe="$1"
    local module_name="$2"
    "$python_exe" -c "import ${module_name}" >/dev/null 2>&1
}

ensure_scraping_python_dependencies() {
    local scrap_dir="$1"
    local python_exe="$2"
    local requirements_path="$scrap_dir/requirements.txt"
    local deps_stamp_path="$scrap_dir/.venv/.deps-installed"
    local need_install="false"

    [ -f "$requirements_path" ] || fail "requirements.txt introuvable pour le service de scraping."

    if ! python_module_available "$python_exe" "uvicorn"; then
        need_install="true"
    elif [ ! -f "$deps_stamp_path" ] || [ "$requirements_path" -nt "$deps_stamp_path" ]; then
        need_install="true"
    fi

    if [ "$need_install" = "false" ]; then
        ok "Dépendances Python du scraping déjà à jour."
        return
    fi

    warn "Installation des dépendances Python du scraping..."
    "$python_exe" -m pip install -r "$requirements_path" || fail "Échec de l'installation des dépendances Python."
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$deps_stamp_path"
    ok "Dépendances Python du scraping à jour."
}

ensure_scraping_playwright_chromium() {
    local scrap_dir="$1"
    local python_exe="$2"
    local requirements_path="$scrap_dir/requirements.txt"
    local browser_stamp_path="$scrap_dir/.venv/.playwright-chromium-installed"
    local need_install="false"

    if ! python_module_available "$python_exe" "playwright"; then
        need_install="true"
    elif [ ! -f "$browser_stamp_path" ] || [ "$requirements_path" -nt "$browser_stamp_path" ]; then
        need_install="true"
    fi

    if [ "$need_install" = "false" ]; then
        ok "Playwright Chromium déjà installé pour le scraping."
        return
    fi

    warn "Installation de Playwright Chromium pour le scraping..."
    PLAYWRIGHT_BROWSERS_PATH=0 "$python_exe" -m playwright install chromium || fail "Échec de l'installation de Playwright Chromium."
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$browser_stamp_path"
    ok "Playwright Chromium prêt pour le scraping."
}

resolve_listings_mode() {
    local env_file="$ROOT/frontend/.env"

    if [ ! -f "$env_file" ]; then
        echo "local-json"
        return
    fi

    local raw
    raw="$(grep -E '^[[:space:]]*VITE_LISTINGS_DATA_MODE[[:space:]]*=' "$env_file" | tail -n 1 | cut -d '=' -f 2- | tr -d '\r' | xargs || true)"
    raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"

    if [ "$raw" = "api" ]; then
        echo "api"
        return
    fi

    echo "local-json"
}

LISTINGS_MODE="$(resolve_listings_mode)"

step "Mode de données annonces: ${LISTINGS_MODE}"
if [ "$LISTINGS_MODE" = "api" ]; then
    ok "Mode API détecté: PostgreSQL + Backend API seront démarrés."
else
    ok "Mode local-json détecté: PostgreSQL ignoré, Backend API lancé pour la console."
fi

if [ "$LISTINGS_MODE" = "api" ]; then
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

fi

# ── 3. Dépendances npm (frontend + backend/api) ─────────────────
step "Installation des paquets npm (frontend et backend/api)..."
(cd "$ROOT/frontend" && npm install) || fail "Échec de npm install dans frontend."
ok "Paquets frontend installés."
(cd "$ROOT/backend/api" && npm install) || fail "Échec de npm install dans backend/api."
ok "Paquets backend/api installés."

# ── 4. Backend API (:4000) ────────────────────────────────────
step "Démarrage du Backend API..."
if port_in_use 4000; then
    ok "Backend API déjà actif (localhost:4000)."
else
    if open_service_terminal "IndieHost API :4000" "$ROOT/backend/api" "npm run dev"; then
        ok "Backend API démarré dans un terminal dédié (localhost:4000)."
    else
        (cd "$ROOT/backend/api" && npm run dev &)
        warn "Aucun terminal externe détecté: Backend API démarré en arrière-plan (localhost:4000)."
    fi
fi

# ── 5. Scraping (:8000) ───────────────────────────────────────
step "Démarrage du serveur de scraping..."
if port_in_use 8000; then
    ok "Serveur de scraping déjà actif (localhost:8000)."
else
    PYTHON="$ROOT/backend/microservices/microservice-scraping-py/.venv/bin/python"
    SCRAP_DIR="$ROOT/backend/microservices/microservice-scraping-py"

    if [ ! -x "$PYTHON" ]; then
        warn "Environnement Python introuvable. Initialisation automatique du .venv..."
        if command -v python3 &>/dev/null; then
            (cd "$SCRAP_DIR" && python3 -m venv .venv) || fail "Échec de la création du .venv du scraping."
        elif command -v python &>/dev/null; then
            (cd "$SCRAP_DIR" && python -m venv .venv) || fail "Échec de la création du .venv du scraping."
        else
            fail "Python 3 est introuvable. Installe Python 3.10+ puis relance le script."
        fi
    fi

    ensure_scraping_python_dependencies "$SCRAP_DIR" "$PYTHON"
    ensure_scraping_playwright_chromium "$SCRAP_DIR" "$PYTHON"

    cd "$SCRAP_DIR" && PLAYWRIGHT_BROWSERS_PATH=0 "$PYTHON" -m uvicorn api:app --reload --port 8000 &
    ok "Serveur de scraping démarré en arrière-plan (localhost:8000)."
fi

# ── 6. Frontend (:5179) ───────────────────────────────────────
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
if [ "$LISTINGS_MODE" = "api" ]; then
    echo "  PostgreSQL  localhost:5432"
else
    echo "  PostgreSQL  désactivé (mode local-json)"
fi
echo "  API         http://localhost:4000"
echo "  Scraping    http://localhost:8000"
echo "  Frontend    http://localhost:5179"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo ""

wait
