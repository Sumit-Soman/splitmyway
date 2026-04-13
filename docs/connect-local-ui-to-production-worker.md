# Connect local Next.js UI to production Cloudflare Worker

Your app calls the Worker from **Next.js server code** (Server Actions), so the browser does not need CORS for those requests. You only need the correct **`WORKER_API_URL`** and a matching **`WORKER_JWT_SECRET`**.

**Warning:** Local code bugs can create, update, or delete **real production data**. Use a staging Worker + D1 first if you can.

---

## Part A — One-time Cloudflare setup (production Worker + D1)

### 1) Log in to Wrangler (CLI)

```bash
cd /Users/rocketlauncher/Documents/playground/splitmyway/apps/worker
npx wrangler login
```

#### If you see `zsh: command not found: npx`

Node is not on your `PATH` (often with **nvm**). In the **same** terminal, run one of these, then try again:

**Option A — load nvm (recommended)**

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/rocketlauncher/Documents/playground/splitmyway/apps/worker
npx wrangler login
```

**Option B — use the local Wrangler binary (after `npm install` in this repo)**

```bash
cd /Users/rocketlauncher/Documents/playground/splitmyway/apps/worker
./node_modules/.bin/wrangler login
```

**Option C — run Wrangler from the repo root (npm must work there)**

```bash
cd /Users/rocketlauncher/Documents/playground/splitmyway
npm exec -w @splitmyway/worker -- wrangler login
```

To avoid this next time, ensure your `~/.zshrc` contains the usual nvm block so new terminals load Node automatically.

### 2) Create a production D1 database (if you do not have one yet)

```bash
npx wrangler d1 create splitmyway
```

Copy the printed **`database_id`** (UUID).

### 3) Put that UUID in `wrangler.jsonc`

Edit `apps/worker/wrangler.jsonc` → under `d1_databases[0]`, set:

```jsonc
"database_id": "<paste-your-real-uuid-here>"
```

Keep `database_name` aligned with what you use in CLI commands (here: `splitmyway`).

### 4) Apply schema to **remote** D1

```bash
cd apps/worker
npx wrangler d1 migrations apply splitmyway --remote
```

### 5) Set production JWT secret (do not commit real secrets)

Pick a long random string (password manager). Then:

```bash
npx wrangler secret put JWT_SECRET
```

Paste the same value when prompted. This becomes the signing key for login tokens in production.

**Recommended:** Remove or replace the placeholder `JWT_SECRET` under `vars` in `wrangler.jsonc` for anything you deploy publicly, so you are not relying on a committed default.

### 6) Deploy the Worker

From repo root:

```bash
npm run worker:deploy
```

Or:

```bash
cd apps/worker && npx wrangler deploy
```

### 7) Copy the production Worker URL

After deploy, Wrangler prints a URL like:

`https://splitmyway-api.<your-subdomain>.workers.dev`

That is your **`WORKER_API_URL`** base (no trailing slash).

---

## Part B — Point local Next.js at production

### 1) Edit repo root `.env`

Set:

```env
WORKER_API_URL=https://splitmyway-api.<your-subdomain>.workers.dev
WORKER_JWT_SECRET=<exact same value you set with wrangler secret put JWT_SECRET>
```

Save the file.

### 2) Restart Next.js

Stop `npm run dev` and start it again so env is reloaded.

### 3) Smoke test

1. Open `http://localhost:3000/login`.
2. Sign in or sign up — requests go to **production** Worker and **remote** D1.

Until you migrate PocketBase data, production D1 may be empty except for users you create here.

---

## Part C — Migrate PocketBase data into **production** D1 (after UI is connected)

Do this **after** Part A step 4 (migrations already applied on remote).

### 1) Point migration env at your PocketBase

In `.env` (or a dedicated env file you pass to `tsx`):

- `POCKETBASE_URL` — your live PocketBase URL (e.g. Fly app).
- `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` — admin API access.

Optional for password hashes:

- `PB_SQLITE_PATH` — path to `data.db` if you have a file export (plus `better-sqlite3` installed).

### 2) Generate SQL from PocketBase

```bash
cd /Users/rocketlauncher/Documents/playground/splitmyway
DRY_RUN=1 npm run migrate:pb-to-d1
npm run migrate:pb-to-d1 -- --out=./scripts/d1-import-production.sql
```

Review the summary in the terminal (found / migrated / skipped / failed).

### 3) Apply SQL to **remote** D1

```bash
cd apps/worker
npx wrangler d1 execute splitmyway --remote --file=../../scripts/d1-import-production.sql
```

### 4) Re-test login

Use migrated user emails; passwords match only if hashes were imported via `PB_SQLITE_PATH`. Otherwise reset passwords using the app’s change-password flow or seed users again.

---

## Quick checklist

| Step | Local UI → prod? |
|------|------------------|
| `WORKER_API_URL` = `https://…workers.dev` | Yes |
| `WORKER_JWT_SECRET` matches `wrangler secret put JWT_SECRET` | Yes |
| `wrangler d1 migrations apply … --remote` done | Yes (empty DB until migrate) |
| `wrangler deploy` done | Yes |
| Restart `npm run dev` after `.env` change | Yes |

---

## Is local “connected to prod Cloudflare”?

**Only if** `WORKER_API_URL` in `.env` is your **deployed** Worker URL. If it is `http://127.0.0.1:8787`, you are still on **local** Worker + **local** D1.
