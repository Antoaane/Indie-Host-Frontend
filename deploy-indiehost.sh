#!/usr/bin/env bash
# Mise à jour de la production : code, migrations, API et site.
#
# Le service de scraping n'est pas reconstruit (image Playwright de ~2 Go, ~15 min) : il ne change
# presque jamais. Pour le reconstruire aussi : ./deploy-indiehost.sh --with-scraping
#
# À la fin, le script vérifie que l'API qui répond est bien la nouvelle : le 2026-11-11, le site
# avait été mis à jour sans l'API, et des pages entières répondaient « Route … not found ».
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

read_env_value() {
  awk -v key="$1" '
    BEGIN { FS = "=" }
    $1 == key {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  ' .env
}

SERVICES=(migrate api frontend)
if [[ "${1:-}" == "--with-scraping" ]]; then
  SERVICES+=(scraping)
fi

echo "→ Récupération du code"
git pull --ff-only

echo "→ Construction : ${SERVICES[*]}"
docker compose build "${SERVICES[@]}"

echo "→ Démarrage (migrations comprises)"
docker compose up -d --wait

echo "→ Vérification de l'API en ligne"
DOMAIN="$(read_env_value SSL_DOMAIN)"
DOMAIN="${DOMAIN:-indiehost.fr}"

# Routes récentes, appelées sans session : la nouvelle API répond 401 (connexion requise),
# une ancienne API répond 404 (route inconnue).
failed=0
check_route() {
  local method="$1" path="$2" code
  code="$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "https://$DOMAIN$path" || true)"
  if [[ "$code" == "401" ]]; then
    echo "  ok   $method $path"
  else
    echo "  ÉCHEC $method $path → $code (401 attendu)"
    failed=1
  fi
}

check_route GET /api/v1/payments/stripe/connect/overview
check_route PUT /api/v1/listings/verification/page

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "L'API en ligne n'est pas la nouvelle version. Journaux : docker compose logs --tail 80 api"
  exit 1
fi

echo
echo "Déploiement terminé : site et API à jour."
docker compose ps
