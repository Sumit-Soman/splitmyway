/**
 * PocketBase → Cloudflare D1 migration helper.
 *
 * Usage:
 *   DRY_RUN=1 tsx --env-file=.env scripts/migrate-pocketbase-to-d1.ts
 *   PB_SQLITE_PATH=./pb_data/data.db tsx --env-file=.env scripts/migrate-pocketbase-to-d1.ts --out=./scripts/pb-to-d1-import.sql
 *   cd apps/worker && npx wrangler d1 execute splitmyway --remote --file=../../scripts/pb-to-d1-import.sql
 *
 * Required env:
 *   POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
 *
 * Optional:
 *   PB_SQLITE_PATH — path to PocketBase `data.db` (e.g. ./pb_data/data.db) to copy bcrypt password hashes.
 */

import * as fs from "node:fs";
import PocketBase from "pocketbase";

type Stats = {
  collection: string;
  found: number;
  migrated: number;
  skipped: number;
  failed: number;
};

const dryRun = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
const outIdx = process.argv.findIndex((a) => a.startsWith("--out="));
const outFile = outIdx >= 0 ? process.argv[outIdx]!.split("=")[1]! : "";

function sqlStr(v: string | null | undefined): string {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlNum(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "NULL";
  return String(Math.trunc(v));
}

function minorFromPbAmount(amountText: string): number | null {
  const t = String(amountText ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchAll<T extends { id: string }>(
  pb: PocketBase,
  collection: string,
  filter?: string
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const res = await pb.collection(collection).getList<T>(page, perPage, {
      ...(filter ? { filter } : {}),
    });
    out.push(...res.items);
    if (res.items.length < perPage) break;
    page++;
  }
  return out;
}

async function loadPasswordMapFromSqlite(path: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(path);
    const rows = db.prepare("SELECT id, password FROM users WHERE password IS NOT NULL").all() as Array<{
      id: string;
      password: string;
    }>;
    for (const r of rows) {
      if (r.id && r.password) map.set(r.id, r.password);
    }
    db.close();
  } catch {
    console.warn(
      "[migrate] Optional dependency `better-sqlite3` not installed or DB unreadable — install it to copy password hashes from pb_data/data.db (set PB_SQLITE_PATH)."
    );
  }
  return map;
}

async function main() {
  const url = process.env.POCKETBASE_URL;
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
  const adminPass = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!url || !adminEmail || !adminPass) {
    console.error("Missing POCKETBASE_URL or POCKETBASE_ADMIN_* env vars.");
    process.exit(1);
  }

  const pb = new PocketBase(url.replace(/\/$/, ""));
  await pb.admins.authWithPassword(adminEmail, adminPass);

  const sqlitePath = process.env.PB_SQLITE_PATH;
  const passwordByUserId = sqlitePath ? await loadPasswordMapFromSqlite(sqlitePath) : new Map<string, string>();

  // D1 `wrangler d1 execute --remote` rejects BEGIN/COMMIT in uploaded SQL; keep plain statements only.
  const lines: string[] = [];
  const stats: Stats[] = [];

  const bump = (s: Stats, ok: boolean, skip: boolean) => {
    if (skip) s.skipped++;
    else if (ok) s.migrated++;
    else s.failed++;
  };

  // --- users ---
  const uStat: Stats = { collection: "users", found: 0, migrated: 0, skipped: 0, failed: 0 };
  const users = await fetchAll<Record<string, unknown>>(pb, "users");
  uStat.found = users.length;
  for (const u of users) {
    const id = String(u.id ?? "");
    const email = String(u.email ?? "").trim().toLowerCase();
    if (!id || !email) {
      bump(uStat, false, true);
      continue;
    }
    const hash = passwordByUserId.get(id) ?? "$2a$10$invalid.invalid.invalid.invalid.invalid.invalidxxxxx";
    if (!passwordByUserId.has(id)) {
      console.warn(`[migrate] user ${id} (${email}): no password hash from SQLite; placeholder inserted — user must reset password.`);
    }
    const name = u.name != null ? String(u.name) : null;
    const currency = String(u.currency ?? "USD").toUpperCase();
    const created = String(u.created ?? nowIso());
    const updated = String(u.updated ?? created);
    lines.push(
      `INSERT OR REPLACE INTO users (id, email, password_hash, name, currency, avatar_mime, avatar_blob, created_at, updated_at) VALUES (${sqlStr(
        id
      )}, ${sqlStr(email)}, ${sqlStr(hash)}, ${name == null ? "NULL" : sqlStr(name)}, ${sqlStr(
        currency
      )}, NULL, NULL, ${sqlStr(created)}, ${sqlStr(updated)});`
    );
    bump(uStat, true, false);
  }
  stats.push(uStat);

  // --- groups ---
  const gStat: Stats = { collection: "groups", found: 0, migrated: 0, skipped: 0, failed: 0 };
  const groups = await fetchAll<Record<string, unknown>>(pb, "groups");
  gStat.found = groups.length;
  for (const g of groups) {
    const id = String(g.id ?? "");
    if (!id) {
      bump(gStat, false, true);
      continue;
    }
    const created = String(g.created ?? nowIso());
    const updated = String(g.updated ?? created);
    lines.push(
      `INSERT OR REPLACE INTO groups (id, name, description, category, currency, created_by, created_at, updated_at) VALUES (${sqlStr(
        id
      )}, ${sqlStr(String(g.name ?? ""))}, ${sqlStr(String(g.description ?? ""))}, ${sqlStr(
        String(g.category ?? "other")
      )}, ${sqlStr(String(g.currency ?? "USD").toUpperCase())}, NULL, ${sqlStr(created)}, ${sqlStr(updated)});`
    );
    bump(gStat, true, false);
  }
  stats.push(gStat);

  // --- group_members ---
  const gmStat: Stats = { collection: "group_members", found: 0, migrated: 0, skipped: 0, failed: 0 };
  const gms = await fetchAll<Record<string, unknown>>(pb, "group_members");
  gmStat.found = gms.length;
  for (const m of gms) {
    const id = String(m.id ?? "");
    const uid = String(m.user ?? "");
    const gid = String(m.group ?? "");
    if (!id || !uid || !gid) {
      bump(gmStat, false, true);
      continue;
    }
    const joined = String(m.joined_at ?? nowIso());
    lines.push(
      `INSERT OR REPLACE INTO group_members (id, group_id, user_id, role, joined_at) VALUES (${sqlStr(
        id
      )}, ${sqlStr(gid)}, ${sqlStr(uid)}, ${sqlStr(String(m.role ?? "member"))}, ${sqlStr(joined)});`
    );
    bump(gmStat, true, false);
  }
  stats.push(gmStat);

  // --- expenses + expense_shares ---
  const eStat: Stats = { collection: "expenses", found: 0, migrated: 0, skipped: 0, failed: 0 };
  const es = await fetchAll<Record<string, unknown>>(pb, "expenses");
  eStat.found = es.length;
  for (const e of es) {
    const id = String(e.id ?? "");
    const gid = String(e.group ?? "");
    const paidBy = String(e.paid_by ?? "");
    const amountMinor = minorFromPbAmount(String(e.amount ?? ""));
    if (!id || !gid || !paidBy || amountMinor == null) {
      bump(eStat, false, true);
      continue;
    }
    const created = String(e.created ?? nowIso());
    const updated = String(e.updated ?? created);
    const origMinor = e.original_amount ? minorFromPbAmount(String(e.original_amount)) : null;
    const ex =
      e.exchange_rate != null && String(e.exchange_rate).trim() !== ""
        ? Math.round(Number(String(e.exchange_rate)) * 1e8)
        : null;
    lines.push(
      `INSERT OR REPLACE INTO expenses (id, group_id, paid_by_user_id, description, amount_minor, currency, original_amount_minor, original_currency, exchange_rate_e8, category, expense_date, notes, split_type, attachment_mime, attachment_blob, created_by, created_at, updated_at) VALUES (${sqlStr(
        id
      )}, ${sqlStr(gid)}, ${sqlStr(paidBy)}, ${sqlStr(String(e.description ?? ""))}, ${sqlNum(
        amountMinor
      )}, ${sqlStr(String(e.currency ?? "USD").toUpperCase())}, ${sqlNum(
        origMinor
      )}, ${e.original_currency ? sqlStr(String(e.original_currency)) : "NULL"}, ${sqlNum(
        ex
      )}, ${sqlStr(String(e.category ?? "general"))}, ${sqlStr(String(e.date ?? created))}, ${sqlStr(
        String(e.notes ?? "")
      )}, ${sqlStr(String(e.split_method ?? "equal"))}, NULL, NULL, NULL, ${sqlStr(created)}, ${sqlStr(
        updated
      )});`
    );
    bump(eStat, true, false);
  }
  stats.push(eStat);

  const pStat: Stats = { collection: "expense_participants", found: 0, migrated: 0, skipped: 0, failed: 0 };
  const parts = await fetchAll<Record<string, unknown>>(pb, "expense_participants");
  pStat.found = parts.length;
  for (const p of parts) {
    const id = String(p.id ?? "");
    const eid = String(p.expense ?? "");
    const uid = String(p.user ?? "");
    const shareMinor = minorFromPbAmount(String(p.amount ?? ""));
    if (!id || !eid || !uid || shareMinor == null) {
      bump(pStat, false, true);
      continue;
    }
    const shares = typeof p.shares === "number" ? Math.floor(p.shares) : null;
    const pctRaw = p.percentage != null && String(p.percentage).trim() !== "" ? Number(String(p.percentage)) : null;
    const pctBps = pctRaw != null && Number.isFinite(pctRaw) ? Math.round(pctRaw * 100) : null;
    lines.push(
      `INSERT OR REPLACE INTO expense_shares (id, expense_id, user_id, share_amount_minor, shares, percentage_bps) VALUES (${sqlStr(
        id
      )}, ${sqlStr(eid)}, ${sqlStr(uid)}, ${sqlNum(shareMinor)}, ${shares == null ? "NULL" : sqlNum(
        shares
      )}, ${pctBps == null ? "NULL" : sqlNum(pctBps)});`
    );
    bump(pStat, true, false);
  }
  stats.push(pStat);

  // --- settlements → payments ---
  const sStat: Stats = { collection: "settlements", found: 0, migrated: 0, skipped: 0, failed: 0 };
  const sts = await fetchAll<Record<string, unknown>>(pb, "settlements");
  sStat.found = sts.length;
  for (const s of sts) {
    const id = String(s.id ?? "");
    const gid = String(s.group ?? "");
    const fromU = String(s.from_user ?? "");
    const toU = String(s.to_user ?? "");
    const amt = minorFromPbAmount(String(s.amount ?? ""));
    if (!id || !gid || !fromU || !toU || amt == null) {
      bump(sStat, false, true);
      continue;
    }
    const paidAt = String(s.settled_at ?? nowIso());
    const created = String(s.created ?? paidAt);
    const updated = String(s.updated ?? paidAt);
    lines.push(
      `INSERT OR REPLACE INTO payments (id, group_id, from_user_id, to_user_id, amount_minor, currency, notes, paid_at, created_at, updated_at) VALUES (${sqlStr(
        id
      )}, ${sqlStr(gid)}, ${sqlStr(fromU)}, ${sqlStr(toU)}, ${sqlNum(amt)}, ${sqlStr(
        String(s.currency ?? "USD").toUpperCase()
      )}, ${sqlStr(String(s.notes ?? ""))}, ${sqlStr(paidAt)}, ${sqlStr(created)}, ${sqlStr(updated)});`
    );
    bump(sStat, true, false);
  }
  stats.push(sStat);

  // --- invitations ---
  const iStat: Stats = { collection: "invitations", found: 0, migrated: 0, skipped: 0, failed: 0 };
  const invs = await fetchAll<Record<string, unknown>>(pb, "invitations");
  iStat.found = invs.length;
  for (const i of invs) {
    const id = String(i.id ?? "");
    const gid = String(i.group ?? "");
    const invitedBy = String(i.invited_by ?? "");
    if (!id || !gid || !invitedBy) {
      bump(iStat, false, true);
      continue;
    }
    const created = String(i.created ?? nowIso());
    const updated = String(i.updated ?? created);
    lines.push(
      `INSERT OR REPLACE INTO invitations (id, group_id, email, token, status, invited_by, expires_at, created_at, updated_at) VALUES (${sqlStr(
        id
      )}, ${sqlStr(gid)}, ${i.email ? sqlStr(String(i.email).toLowerCase()) : "NULL"}, ${sqlStr(
        String(i.token ?? "")
      )}, ${sqlStr(String(i.status ?? "pending"))}, ${sqlStr(invitedBy)}, ${sqlStr(
        String(i.expires_at ?? created)
      )}, ${sqlStr(created)}, ${sqlStr(updated)});`
    );
    bump(iStat, true, false);
  }
  stats.push(iStat);


  console.log("\n=== PocketBase → D1 migration summary ===\n");
  for (const s of stats) {
    console.log(
      `${s.collection}: found=${s.found} migrated=${s.migrated} skipped=${s.skipped} failed=${s.failed}`
    );
  }

  const sql = lines.join("\n");
  if (outFile) {
    fs.writeFileSync(outFile, sql, "utf8");
    console.log(`\nWrote SQL to ${outFile}`);
    console.log("Apply locally: npx wrangler d1 execute splitmyway --local --file=" + outFile);
    console.log("Apply remote:  npx wrangler d1 execute splitmyway --remote --file=" + outFile);
  } else if (!dryRun && !outFile) {
    console.warn("\nNo --out= path provided; printed SQL to stdout only (truncated preview):\n");
    console.log(sql.slice(0, 2000) + (sql.length > 2000 ? "\n... [truncated]\n" : ""));
  }

  if (dryRun) {
    console.log("\nDRY_RUN=1: no file written.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
