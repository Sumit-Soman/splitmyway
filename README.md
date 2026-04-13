# SplitMyWay

Splitwise-style expense sharing. **Frontend:** Next.js on Vercel. **Backend:** Cloudflare Workers + D1. **Auth:** HS256 JWT in an httpOnly cookie (`smw_token`), verified by Next.js middleware and the Worker.

## Repository layout

- `src/` — Next.js app (server actions call the Worker API).
- `apps/worker/` — Cloudflare Worker (Hono + D1).
- `apps/worker/migrations/` — D1 SQL migrations.
- `scripts/migrate-pocketbase-to-d1.ts` — PocketBase → D1 SQL export.
- `pb_migrations/` — legacy PocketBase schema (optional local PB).

## Prerequisites

- Node 20+
- Cloudflare account (Workers + D1 free tiers are enough for a handful of users).

## Environment variables

Copy `.env.example` to `.env` for local development.

| Variable | Where | Purpose |
|----------|--------|---------|
| `WORKER_API_URL` | Vercel + local `.env` | Worker origin, e.g. `https://splitmyway-api.<subdomain>.workers.dev` |
| `WORKER_JWT_SECRET` | Vercel + Wrangler | Same secret as Worker JWT signing |
| `JWT_SECRET` | Worker (`wrangler.jsonc` vars or secret) | Must match `WORKER_JWT_SECRET` |
| `CORS_ORIGINS` | Worker vars | Comma-separated allowed browser origins (include `https://your-app.vercel.app` if the browser calls the Worker directly; Next server actions only need consistent server-side `WORKER_API_URL`) |

## Local development

1. **Install dependencies** (from repo root):

   ```bash
   npm install
   cd apps/worker && npm install && cd ../..
   ```

2. **Create local D1** (once):

   ```bash
   cd apps/worker
   npx wrangler d1 create splitmyway
   ```

   Put the printed `database_id` into `apps/worker/wrangler.jsonc` (`d1_databases[0].database_id`).

3. **Apply D1 schema locally:**

   ```bash
   cd apps/worker
   npx wrangler d1 migrations apply splitmyway --local
   ```

4. **Run the Worker dev server:**

   ```bash
   npm run worker:dev
   ```

   Default: `http://127.0.0.1:8787`.

5. **Run Next.js** (new terminal, repo root):

   ```bash
   npm run dev
   ```

   Set `.env`:

   ```
   WORKER_API_URL=http://127.0.0.1:8787
   WORKER_JWT_SECRET=change-me-in-production-use-wrangler-secret
   ```

   Use the **same** string as `JWT_SECRET` in `apps/worker/wrangler.jsonc` for local dev.

6. **Create a user** via `/signup` or insert SQL / migration from PocketBase.

## PocketBase → D1 migration

1. Ensure PocketBase is reachable and admin credentials are in `.env` (`POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`).
2. _(Recommended)_ Set `PB_SQLITE_PATH=./pb_data/data.db` and `npm install better-sqlite3` so password hashes are copied.
3. Generate SQL:

   ```bash
   DRY_RUN=1 npm run migrate:pb-to-d1
   npm run migrate:pb-to-d1 -- --out=./scripts/d1-import.sql
   ```

4. Apply to local D1:

   ```bash
   cd apps/worker
   npx wrangler d1 execute splitmyway --local --file=../../scripts/d1-import.sql
   ```

5. Apply to **production** D1 after backup:

   ```bash
   npx wrangler d1 execute splitmyway --remote --file=../../scripts/d1-import.sql
   ```

See `docs/migration-plan.md` for ordering, ID strategy, and rollback.

## Deploy Worker (production)

```bash
cd apps/worker
npx wrangler secret put JWT_SECRET
# Set CORS in apps/worker/wrangler.jsonc `vars.CORS_ORIGINS` or your preferred Wrangler workflow.
npm run deploy
```

Update Vercel project settings:

- `WORKER_API_URL` → deployed Worker URL  
- `WORKER_JWT_SECRET` → same value as `wrangler secret` JWT_SECRET  

## Deploy frontend (Vercel)

Connect the GitHub repo; build command `npm run build`, output Next.js defaults. No change to hosting model.

## Verification checklist

- [ ] Signup + login; cookie `smw_token` set.
- [ ] Dashboard loads groups and balances.
- [ ] Group detail: members, expenses, balances, suggestions, settlements.
- [ ] Create / edit / delete expense (incl. multi-currency path if used).
- [ ] Record settlement; settlements list.
- [ ] CSV/PDF report routes.
- [ ] Profile + avatar upload/remove.
- [ ] Expense attachment preview (`/api/expenses/.../attachment`).

## Rollback

- Revert Vercel env to PocketBase URL and redeploy previous commit if needed.
- Restore D1 from backup before re-import; keep PocketBase `pb_data` snapshot until satisfied.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run worker:dev` | Wrangler dev for `apps/worker` |
| `npm run worker:deploy` | `wrangler deploy` for Worker |
| `npm run migrate:pb-to-d1` | PocketBase → SQL export |
| `npm run pb:serve` | _(Legacy)_ local PocketBase |
