#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p .run

# Stop previous local processes if tracked
for f in .run/api.pid .run/scraping.pid .run/frontend.pid; do
  if [[ -f "$f" ]]; then
    pid="$(cat "$f" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
    fi
    rm -f "$f"
  fi
done

# Free common dev ports if needed
for p in 4000 8000 5179; do
  pids="$(lsof -t -iTCP:$p -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids || true
  fi
done

# Stop docker stack remnants
docker compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans >/dev/null 2>&1 || true

# Temporary override to expose postgres on localhost:5432
cat > .run/docker-compose.postgres-local.yml <<'YAML'
services:
  postgres:
    ports:
      - "5432:5432"
YAML

# Start only preflight + postgres, no image build
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f .run/docker-compose.postgres-local.yml up -d --no-build preflight postgres

# Wait for postgres health
POSTGRES_CID="$(docker compose -f docker-compose.yml -f docker-compose.dev.yml -f .run/docker-compose.postgres-local.yml ps -q postgres)"
if [[ -z "$POSTGRES_CID" ]]; then
  echo "postgres container not found" >&2
  exit 1
fi

for i in {1..90}; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$POSTGRES_CID")"
  if [[ "$status" == "healthy" || "$status" == "running" ]]; then
    break
  fi
  sleep 1
done

# Start API locally
(
  cd backend/api
  nohup bash -lc '
    set -euo pipefail
    DATABASE_URL="$(node -e '\''const fs=require("fs"); const raw=fs.readFileSync("../../secrets/database_url.txt","utf8").trim(); const u=new URL(raw); u.hostname="localhost"; if(!u.port) u.port="5432"; process.stdout.write(u.toString())'\'')"
    export DATABASE_URL
    npm run prisma:generate
    npm run prisma:push
    npm run dev
  ' > ../../.run/api.log 2>&1 &
  echo $! > ../../.run/api.pid
)

# Start scraping locally (venv)
(
  cd backend/microservices/microservice-scraping-py
  nohup bash -lc '
    set -euo pipefail
    source .venv/bin/activate
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
  ' > ../../../.run/scraping.log 2>&1 &
  echo $! > ../../../.run/scraping.pid
)

# Start frontend locally
(
  cd frontend
  nohup bash -lc '
    set -euo pipefail
    export VITE_API_PROXY_TARGET=http://localhost:4000
    export VITE_SCRAPING_PROXY_TARGET=http://localhost:8000
    npm run dev -- --host 0.0.0.0 --port 5179 --strictPort
  ' > ../.run/frontend.log 2>&1 &
  echo $! > ../.run/frontend.pid
)

wait_http() {
  local name="$1"
  local url="$2"
  local timeout="${3:-90}"
  for ((i=0; i<timeout; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name ok"
      return 0
    fi
    sleep 1
  done
  echo "$name not ready: $url" >&2
  return 1
}

wait_http "api" "http://localhost:4000/health" 120
wait_http "scraping" "http://localhost:8000/health" 120
wait_http "frontend" "http://localhost:5179" 120

echo "--- PIDs ---"
cat .run/api.pid .run/scraping.pid .run/frontend.pid | nl -ba

echo "--- Ports ---"
lsof -nP -iTCP:5432 -iTCP:4000 -iTCP:8000 -iTCP:5179 -sTCP:LISTEN || true

echo "--- Postgres compose status ---"
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f .run/docker-compose.postgres-local.yml ps
