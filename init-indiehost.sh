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

  local src_basename
  src_basename="$(basename "$src")"

  local candidate=""
  if [[ -f "$dst/$src_basename" ]]; then
    candidate="$dst/$src_basename"
  else
    local files=()
    local entry
    shopt -s nullglob dotglob
    for entry in "$dst"/*; do
      if [[ -f "$entry" ]]; then
        files+=("$entry")
      fi
    done
    shopt -u nullglob dotglob

    if [[ "${#files[@]}" -eq 1 ]]; then
      candidate="${files[0]}"
    fi
  fi

  local tmp_file
  tmp_file="$(mktemp)"
  if [[ -n "$candidate" ]]; then
    cp "$candidate" "$tmp_file"
    echo "[init] Replaced directory by file $dst (preserved content from $candidate)"
  else
    cp "$src" "$tmp_file"
    echo "[init] Replaced directory by file $dst (template reapplied from $src)"
  fi

  rm -rf "$dst"
  mv "$tmp_file" "$dst"
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
