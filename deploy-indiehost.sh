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

# nginx lit sa configuration par des montages fichier par fichier : après `git pull`, le conteneur
# garde l'ancienne version (inode remplacé), même avec `nginx -s reload`. On le recrée quand les
# fichiers qu'il lit diffèrent de ceux du dépôt.
nginx_config_changed() {
  docker compose exec -T nginx cat /etc/nginx/snippets/proxy-locations.conf 2>/dev/null | cmp -s - nginx/proxy-locations.conf || return 0
  docker compose exec -T nginx cat /etc/nginx/templates/default.conf.template 2>/dev/null | cmp -s - nginx/nginx.conf.template || return 0
  return 1
}
if nginx_config_changed; then
  echo "→ Configuration nginx modifiée : recréation du conteneur nginx"
  docker compose up -d --force-recreate --wait nginx
fi

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
check_route GET /api/v1/admin/system/health

# Sites des hôtes (2026-11-12) : route publique de l'API (404 « Listing not found » ; l'ancienne API
# répondait 400) et nginx à jour (le shell du site n'est jamais servi au public).
site_check="$(curl -s -w '\n%{http_code}' "https://$DOMAIN/api/v1/listings/deploy-check/site" || true)"
if [[ "$(tail -n 1 <<<"$site_check")" == "404" && "$site_check" == *"Listing not found"* ]]; then
  echo "  ok   GET /api/v1/listings/:id/site"
else
  echo "  ÉCHEC GET /api/v1/listings/:id/site (404 « Listing not found » attendu)"
  failed=1
fi
shell_code="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/__shell.html" || true)"
if [[ "$shell_code" == "404" ]]; then
  echo "  ok   nginx à jour (/__shell.html refusé)"
else
  echo "  ÉCHEC nginx pas à jour : /__shell.html → $shell_code (404 attendu)"
  echo "       docker compose up -d --force-recreate --wait nginx"
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "L'API en ligne n'est pas la nouvelle version. Journaux : docker compose logs --tail 80 api"
  exit 1
fi

echo
echo "Déploiement terminé : site et API à jour."
docker compose ps
