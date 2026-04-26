#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/init-indiehost.sh"

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait

docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

echo
echo "Dev Frontend (via nginx): http://localhost"
echo "Dev Frontend (direct Vite): http://localhost:5179"
echo "API health: http://localhost/api/health"
