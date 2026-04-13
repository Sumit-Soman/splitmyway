# PocketBase → Cloudflare D1 migration plan

## 1. Schema design

- Normalized SQLite tables: `users`, `groups`, `group_members`, `expenses`, `expense_shares`, `payments` (settlements), `invitations`, `activity_logs`.
- Money as **integer minor units** (e.g. cents). Exchange rates stored as `exchange_rate_e8` (rate × 10⁸).
- PocketBase record IDs (15-character strings) are **preserved** as primary keys where possible.

## 2. PocketBase entity mapping

| PocketBase            | D1                          |
|-----------------------|-----------------------------|
| `users`               | `users`                     |
| `groups`              | `groups`                    |
| `group_members`       | `group_members`             |
| `expenses`            | `expenses`                  |
| `expense_participants`| `expense_shares`          |
| `settlements`         | `payments`                  |
| `invitations`         | `invitations`               |
| `activity_logs`       | _(optional; not in SQL export by default)_ |

Binary avatars and expense attachments are **not** migrated by the SQL script (optional follow-up).

## 3. Insert order

Generated SQL is plain `INSERT` statements only (no `BEGIN`/`COMMIT`): Cloudflare D1 remote `wrangler d1 execute --remote` rejects explicit SQL transactions in uploaded files.

1. `users`
2. `groups`
3. `group_members`
4. `expenses`
5. `expense_shares`
6. `payments`
7. `invitations`

## 4. ID preservation

- All PocketBase record IDs are written as-is into D1 `TEXT` primary keys.
- New sign-ups after cutover use the same 15-character generator as PocketBase for consistency.

## 5. Data validation

- Skip rows missing required foreign keys or invalid numeric amounts (logged in script summary).
- Email normalized to lowercase on insert.

## 6. Password hashes

- PocketBase REST does not expose password hashes.
- Set `PB_SQLITE_PATH` to `pb_data/data.db` and install optional `better-sqlite3` so `scripts/migrate-pocketbase-to-d1.ts` can read `users.password` (bcrypt) into D1.
- Without SQLite, the script inserts a **placeholder** hash and those users must use **Change password** (Worker) or a manual SQL update.

## 7. Verification

- Run D1 migrations, apply SQL, then smoke-test: login, list groups, open group detail, balances, add expense, settlement, reports CSV/PDF.
- Compare aggregate totals per group (sum of expenses) against PocketBase export.

## 8. Rollback

- Keep the PocketBase Fly volume / `pb_data` backup until production verification completes.
- D1 rollback: restore from a `.dump` / backup taken before applying the import SQL, or recreate an empty database and re-import a known-good snapshot.
