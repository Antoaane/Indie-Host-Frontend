#!/usr/bin/env sh
set -eu

STRICT_EXTERNAL_CONFIG_RAW="${STRICT_EXTERNAL_CONFIG:-true}"

normalize_bool() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]'
}

is_truthy() {
  case "$(normalize_bool "$1")" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

errors=0

log_info() {
  printf '[preflight][info] %s\n' "$*"
}

log_warn() {
  printf '[preflight][warn] %s\n' "$*" >&2
}

log_error() {
  printf '[preflight][error] %s\n' "$*" >&2
  errors=1
}

read_env_var() {
  name="$1"
  eval "printf '%s' \"\${$name:-}\""
}

require_env_non_empty() {
  name="$1"
  value="$(read_env_var "$name")"
  if [ -z "$value" ]; then
    log_error "Variable .env manquante ou vide: $name"
  fi
}

require_env_equals() {
  name="$1"
  expected="$2"
  value="$(read_env_var "$name")"
  if [ "$value" != "$expected" ]; then
    log_error "Variable .env invalide: $name doit valoir '$expected' (actuel: '${value:-<vide>}')"
  fi
}

reject_env_value() {
  name="$1"
  rejected="$2"
  value="$(read_env_var "$name" | tr '[:upper:]' '[:lower:]')"
  rejected_normalized="$(printf '%s' "$rejected" | tr '[:upper:]' '[:lower:]')"
  if [ "$value" = "$rejected_normalized" ]; then
    log_error "Variable .env invalide pour la prod: $name ne doit pas valoir '$rejected'"
  fi
}

reject_env_contains() {
  name="$1"
  rejected_fragment="$2"
  value="$(read_env_var "$name" | tr '[:upper:]' '[:lower:]')"
  fragment="$(printf '%s' "$rejected_fragment" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    *"$fragment"*) log_error "Variable .env invalide pour la prod: $name contient '$rejected_fragment'" ;;
  esac
}

require_secret_non_empty() {
  file_name="$1"
  path="/secrets/$file_name"

  if [ -d "$path" ]; then
    log_error "Secret invalide: $path est un dossier (attendu: un fichier .txt). Lance ./init-indiehost.sh ou ./init-indiehost.ps1."
    return
  fi

  if [ ! -f "$path" ]; then
    log_error "Secret manquant: $path"
    return
  fi

  if [ ! -s "$path" ]; then
    log_error "Secret vide: $path"
    return
  fi

  trimmed="$(tr -d '\r' < "$path" | sed -e 's/[[:space:]]*$//')"
  if [ -z "$trimmed" ]; then
    log_error "Secret vide (apres trim): $path"
  fi
}

require_secret_exists() {
  file_name="$1"
  path="/secrets/$file_name"
  if [ -d "$path" ]; then
    log_error "Secret invalide: $path est un dossier (attendu: un fichier .txt)."
    return
  fi
  if [ ! -f "$path" ]; then
    log_error "Secret manquant: $path"
  fi
}

log_info "Validation de la configuration Docker..."

# Toujours requis pour booter l'API + Prisma.
require_secret_non_empty "database_url.txt"

if is_truthy "$STRICT_EXTERNAL_CONFIG_RAW"; then
  log_info "Mode STRICT_EXTERNAL_CONFIG active: verification complete des integrations externes."

  require_env_equals "NODE_ENV" "production"
  require_env_non_empty "BASE_URL"
  require_env_non_empty "SSL_DOMAIN"
  require_env_non_empty "SSL_EMAIL"
  require_env_non_empty "PUBLIC_LISTING_ROOT_DOMAIN"
  require_env_non_empty "VITE_CLERK_PUBLISHABLE_KEY"
  require_env_non_empty "VITE_STRIPE_PUBLISHABLE_KEY"
  require_env_non_empty "VITE_STRIPE_PAYMENT_RETURN_URL"
  require_env_non_empty "VITE_PUBLIC_LISTING_ROOT_DOMAIN"
  require_env_non_empty "CLERK_JWKS_URL"
  require_env_non_empty "CLERK_ISSUER"
  require_env_non_empty "IMAGEKIT_ENDPOINT"

  reject_env_value "SSL_DOMAIN" "localhost"
  reject_env_value "PUBLIC_LISTING_ROOT_DOMAIN" "localhost"
  reject_env_value "VITE_PUBLIC_LISTING_ROOT_DOMAIN" "localhost"
  reject_env_contains "BASE_URL" "localhost"
  reject_env_contains "VITE_STRIPE_PAYMENT_RETURN_URL" "localhost"

  require_secret_non_empty "stripe_secret_key.txt"
  require_secret_non_empty "clerk_secret_key.txt"
  require_secret_non_empty "imagekit_api_key.txt"
  require_secret_non_empty "cloudflare.ini"
else
  log_warn "Mode STRICT_EXTERNAL_CONFIG desactive: seules les dependances minimales sont validees."
  require_secret_exists "stripe_secret_key.txt"
  require_secret_exists "clerk_secret_key.txt"
  require_secret_exists "imagekit_api_key.txt"
fi

if [ ! -f "/secrets/cloudflare.ini" ]; then
  log_warn "Secret optionnel absent: /secrets/cloudflare.ini (necessaire pour HTTPS wildcard Cloudflare auto)."
fi

if [ "$errors" -ne 0 ]; then
  log_error "Configuration invalide. Corrige .env et secrets/*.txt, puis relance docker compose."
  exit 1
fi

log_info "Configuration validee."
