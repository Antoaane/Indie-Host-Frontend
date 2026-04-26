#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/init-indiehost.sh"

docker compose up -d --build --wait

docker compose ps

echo
echo "Frontend: http://localhost"
echo "API health: http://localhost/api/health"
