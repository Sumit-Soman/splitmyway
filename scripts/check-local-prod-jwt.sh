#!/usr/bin/env bash
# Ensure Next and Wrangler agree on the JWT before hitting production D1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_VARS="$ROOT/apps/worker/.dev.vars"
ENV_LOCAL="$ROOT/.env.local"
EXAMPLE_PLACEHOLDER="change-me-in-production-use-wrangler-secret"

if [[ ! -f "$DEV_VARS" ]]; then
  echo "Missing $DEV_VARS — copy apps/worker/.dev.vars.example and set JWT_SECRET to production (Vercel WORKER_JWT_SECRET / wrangler secret JWT_SECRET)."
  exit 1
fi
if [[ ! -f "$ENV_LOCAL" ]]; then
  echo "Missing $ENV_LOCAL — run: npm run local:prod:sync-env"
  exit 1
fi
jwt_dev=$(grep -E '^JWT_SECRET=' "$DEV_VARS" | head -1 | cut -d= -f2- | tr -d '\r')
jwt_next=$(grep -E '^WORKER_JWT_SECRET=' "$ENV_LOCAL" | head -1 | cut -d= -f2- | tr -d '\r')
if [[ -z "${jwt_dev:-}" || -z "${jwt_next:-}" ]]; then
  echo "JWT_SECRET or WORKER_JWT_SECRET is empty."
  exit 1
fi
if [[ "$jwt_dev" != "$jwt_next" ]]; then
  echo "Mismatch: apps/worker/.dev.vars JWT_SECRET and .env.local WORKER_JWT_SECRET must be identical."
  echo "Run: npm run local:prod:sync-env"
  exit 1
fi
if [[ "$jwt_dev" == "$EXAMPLE_PLACEHOLDER" ]]; then
  echo "JWT is still the example placeholder. Set your real production JWT in apps/worker/.dev.vars, then:"
  echo "  npm run local:prod:sync-env"
  exit 1
fi

url=$(grep -E '^WORKER_API_URL=' "$ENV_LOCAL" | head -1 | cut -d= -f2- | tr -d '\r')
if [[ "${url:-}" != "http://127.0.0.1:8787" && "${url:-}" != "http://localhost:8787" ]]; then
  echo "Warning: WORKER_API_URL is '$url' — for wrangler dev it should usually be http://127.0.0.1:8787"
fi

echo "OK: JWT aligned for local Next + remote D1. Requires: npx wrangler login (Cloudflare account with access to this Worker/D1)."
