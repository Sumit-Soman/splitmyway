#!/usr/bin/env bash
# Merge WORKER_API_URL + WORKER_JWT_SECRET into .env.local from apps/worker/.dev.vars (JWT_SECRET).
# Use this when running `npm run worker:dev:remote` with production D1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_VARS="$ROOT/apps/worker/.dev.vars"
ENV_LOCAL="$ROOT/.env.local"
if [[ ! -f "$DEV_VARS" ]]; then
  echo "Missing $DEV_VARS — copy apps/worker/.dev.vars.example and set JWT_SECRET to your production value (same as Vercel WORKER_JWT_SECRET)."
  exit 1
fi
jwt=$(grep -E '^JWT_SECRET=' "$DEV_VARS" | head -1 | cut -d= -f2- | tr -d '\r')
if [[ -z "${jwt:-}" ]]; then
  echo "No JWT_SECRET= line in $DEV_VARS"
  exit 1
fi
URL=http://127.0.0.1:8787
tmp=$(mktemp)
if [[ -f "$ENV_LOCAL" ]]; then
  grep -v -E '^(WORKER_API_URL|WORKER_JWT_SECRET)=' "$ENV_LOCAL" 2>/dev/null | grep -v '^[[:space:]]*$' || true >"$tmp"
fi
{
  echo "WORKER_API_URL=$URL"
  echo "WORKER_JWT_SECRET=$jwt"
  if [[ -s "$tmp" ]]; then
    cat "$tmp"
  fi
} >"$ENV_LOCAL"
rm -f "$tmp"
echo "Updated $ENV_LOCAL from $DEV_VARS (remote worker URL + shared JWT)."
