#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

normalize_secret_path() {
  local src="$1"
  local dst="$2"

  if [[ ! -d "$dst" ]]; then
    return
  fi

  echo "[init][error] $dst est un dossier, mais un fichier est attendu." >&2
  echo "[init][error] Par securite, ce script ne supprime jamais automatiquement des dossiers ou des secrets." >&2
  echo "[init][error] Inspecte ce dossier, sauvegarde son contenu si necessaire, puis renomme-le ou supprime-le manuellement avant de relancer." >&2
  echo "[init][error] Template attendu: $src" >&2
  exit 1
}

copy_if_missing() {
  local src="$1"
  local dst="$2"

  normalize_secret_path "$src" "$dst"

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
copy_if_missing "secret.example/clerk_secret_key.example.txt" "secrets/clerk_secret_key.txt"
copy_if_missing "secret.example/imagekit_api_key.example.txt" "secrets/imagekit_api_key.txt"
copy_if_missing "secret.example/cloudflare.ini.example" "secrets/cloudflare.ini"

echo
echo "[init] Next step: edit .env + secrets/*.txt with real values, then run ./start-indiehost.sh"
