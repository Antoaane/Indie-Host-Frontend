#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

copy_if_missing() {
  local src="$1"
  local dst="$2"

  if [[ ! -f "$dst" ]]; then
    cp "$src" "$dst"
    echo "[init] Created $dst"
  else
    echo "[init] Kept existing $dst"
  fi
}

copy_if_missing ".env.example" ".env"
mkdir -p "secrets"

copy_if_missing "secret.example/database_url.example.txt" "secrets/database_url.txt"
copy_if_missing "secret.example/stripe_secret_key.example.txt" "secrets/stripe_secret_key.txt"
copy_if_missing "secret.example/stripe_webhook_secret.example.txt" "secrets/stripe_webhook_secret.txt"
copy_if_missing "secret.example/clerk_secret_key.example.txt" "secrets/clerk_secret_key.txt"
copy_if_missing "secret.example/gandi_api_token.example.txt" "secrets/gandi_api_token.txt"
copy_if_missing "secret.example/imagekit_api_key.example.txt" "secrets/imagekit_api_key.txt"
copy_if_missing "secret.example/scrapfly_api_key.example.txt" "secrets/scrapfly_api_key.txt"

echo
echo "[init] Next step: edit .env + secrets/*.txt with real values, then run ./start-indiehost.sh"
