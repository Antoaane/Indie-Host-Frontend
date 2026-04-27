#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ] && [ -n "${DATABASE_URL_FILE:-}" ] && [ -f "$DATABASE_URL_FILE" ]; then
  DATABASE_URL="$(tr -d '\r' < "$DATABASE_URL_FILE" | sed -e 's/[[:space:]]*$//')"
  export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL (or DATABASE_URL_FILE) is required" >&2
  exit 1
fi

exec "$@"
