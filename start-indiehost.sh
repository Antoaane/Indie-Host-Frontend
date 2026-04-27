#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/init-indiehost.sh"
cd "$SCRIPT_DIR"

read_env_value() {
  local name="$1"
  awk -v key="$name" '
    BEGIN { FS = "=" }
    $1 == key {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      gsub(/^"|"$/, "")
      gsub(/^'\''|'\''$/, "")
      print
      exit
    }
  ' .env
}

docker compose run --rm preflight

SSL_DOMAIN="$(read_env_value SSL_DOMAIN)"
SSL_EMAIL="$(read_env_value SSL_EMAIL)"
CLOUDFLARE_DNS_PROPAGATION_SECONDS="$(read_env_value CLOUDFLARE_DNS_PROPAGATION_SECONDS)"
CLOUDFLARE_DNS_PROPAGATION_SECONDS="${CLOUDFLARE_DNS_PROPAGATION_SECONDS:-30}"

CERT_PATH="$SCRIPT_DIR/certbot/conf/live/$SSL_DOMAIN/fullchain.pem"
if [[ ! -s "$CERT_PATH" ]]; then
  echo "[certbot] Aucun certificat initial trouve pour $SSL_DOMAIN. Generation DNS-01 Cloudflare..."
  docker compose run --rm --entrypoint certbot certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /run/secrets/cloudflare.ini \
    --dns-cloudflare-propagation-seconds "$CLOUDFLARE_DNS_PROPAGATION_SECONDS" \
    -d "$SSL_DOMAIN" \
    -d "*.$SSL_DOMAIN" \
    --email "$SSL_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive
else
  echo "[certbot] Certificat existant conserve pour $SSL_DOMAIN"
fi

docker compose up -d --build --wait

docker compose ps

echo
echo "Frontend: https://$SSL_DOMAIN"
echo "API health: https://$SSL_DOMAIN/api/health"
echo "Scraping health: https://$SSL_DOMAIN/scraping/health"
