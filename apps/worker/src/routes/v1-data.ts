import type { Hono } from "hono";
import type { HonoEnv } from "../types";
import { z } from "zod";
import { jsonError, jsonOk } from "../lib/errors";
import { genRecordId, nowIso } from "../lib/ids";
import { calculateSplitMinor, type SplitMethod } from "../services/splits-minor";
import {
  calculateBalancesMinor,
  minimizeDebtsMinor,
  minorToDisplayAmount,
} from "../services/balances-minor";
import { MAX_EXPENSE_ATTACHMENT_BYTES, MAX_EXPENSE_ATTACHMENT_ERROR } from "../lib/limits";

const ACTIVITY_TYPES = {
  EXPENSE_ADDED: "expense_added",
  EXPENSE_UPDATED: "expense_updated",
  EXPENSE_DELETED: "expense_deleted",
  SETTLEMENT_RECORDED: "settlement_recorded",
  MEMBER_ADDED: "member_added",
  MEMBER_REMOVED: "member_removed",
  GROUP_CREATED: "group_created",
  GROUP_DELETED: "group_deleted",
} as const;

async function parseJsonSafe<T>(req: Request, schema: z.ZodType<T>): Promise<
  | { ok: true; data: T }
  | { ok: false; error: string }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: "Invalid JSON body." };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join("; ") || "Validation failed." };
  }
  return { ok: true, data: parsed.data };
}

async function logActivity(
  db: D1Database,
  userId: string,
  groupId: string | null,
  type: string,
  metadata: Record<string, unknown> | null
) {
  const id = genRecordId();
  await db
    .prepare(
      `INSERT INTO activity_logs (id, group_id, user_id, type, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, groupId, userId, type, metadata ? JSON.stringify(metadata) : null, nowIso())
    .run();
}

async function assertGroupMember(db: D1Database, userId: string, groupId: string) {
  const m = await db
    .prepare(`SELECT id, role FROM group_members WHERE group_id = ? AND user_id = ?`)
    .bind(groupId, userId)
    .first<{ id: string; role: string }>();
  return m;
}

async function assertGroupAdmin(db: D1Database, userId: string, groupId: string) {
  const m = await assertGroupMember(db, userId, groupId);
  if (!m || m.role !== "admin") return null;
  return m;
}

/** Safe base64 → ArrayBuffer; `atob` + `Uint8Array.buffer` can throw or oversize the blob without this. */
function decodeBase64ToArrayBuffer(b64: string): { ok: true; buf: ArrayBuffer } | { ok: false; error: string } {
  const s = b64.trim();
  if (!s) return { ok: false, error: "Empty attachment data." };
  try {
    const bin = atob(s);
    const len = bin.length;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
    return { ok: true, buf: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) };
  } catch {
    return { ok: false, error: "Invalid attachment encoding." };
  }
}

function expenseDateToIso(dateStr: string): { ok: true; iso: string } | { ok: false } {
  const ms = Date.parse(dateStr);
  if (!Number.isFinite(ms)) return { ok: false };
  return { ok: true, iso: new Date(ms).toISOString() };
}

/** D1/SQLite BLOB bind: use an exact-length Uint8Array (not a sliced ArrayBuffer view). */
function blobBindValue(buf: ArrayBuffer | null): Uint8Array | null {
  if (!buf || buf.byteLength === 0) return null;
  return new Uint8Array(buf);
}

function appendServerTiming(response: Response, metrics: Array<{ name: string; durationMs: number }>): Response {
  if (!metrics.length) return response;
  const existing = response.headers.get("Server-Timing");
  const next = metrics.map((m) => `${m.name};dur=${m.durationMs.toFixed(1)}`).join(", ");
  response.headers.set("Server-Timing", existing ? `${existing}, ${next}` : next);
  return response;
}

export function registerDataRoutes(v1: Hono<HonoEnv>) {
  v1.get("/me/memberships", async (c) => {
    const uid = c.get("userId");
    const rows = await c.env.DB.prepare(
      `SELECT gm.id as membership_id, gm.group_id, gm.role, gm.joined_at,
              g.name as group_name, g.currency as group_currency
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY gm.joined_at DESC`
    )
      .bind(uid)
      .all<{
        membership_id: string;
        group_id: string;
        role: string;
        joined_at: string;
        group_name: string;
        group_currency: string;
      }>();
    const list = rows.results ?? [];
    return jsonOk({
      memberships: list.map((r) => ({
        id: r.membership_id,
        userId: uid,
        groupId: r.group_id,
        role: r.role,
        joinedAt: r.joined_at,
        group: { id: r.group_id, name: r.group_name, currency: r.group_currency },
      })),
    });
  });

  v1.get("/debug/timing", async (c) => {
    const totalStart = performance.now();
    const dbStart = performance.now();
    const probe = await c.env.DB.prepare(`SELECT 1 as ok`).first<{ ok: number }>();
    const dbMs = performance.now() - dbStart;
    const serializeStart = performance.now();
    const response = jsonOk({
      now: nowIso(),
      ok: probe?.ok === 1,
    });
    const serializeMs = performance.now() - serializeStart;
    return appendServerTiming(response, [
      { name: "db", durationMs: dbMs },
      { name: "serialize", durationMs: serializeMs },
      { name: "total", durationMs: performance.now() - totalStart },
    ]);
  });

  v1.get("/dashboard", async (c) => {
    const totalStart = performance.now();
    const uid = c.get("userId");
    const dbStart = performance.now();
    const mems = await c.env.DB.prepare(
      `SELECT gm.group_id, gm.role, g.name, g.currency, g.description, g.category
       FROM group_members gm JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = ?`
    )
      .bind(uid)
      .all<{
        group_id: string;
        role: string;
        name: string;
        currency: string;
        description: string | null;
        category: string;
      }>();
    const groups = mems.results ?? [];
    if (groups.length === 0) {
      const response = jsonOk({
        groupsData: [],
      });
      return appendServerTiming(response, [
        { name: "db", durationMs: performance.now() - dbStart },
        { name: "serialize", durationMs: 0 },
        { name: "total", durationMs: performance.now() - totalStart },
      ]);
    }

    const groupsData = await Promise.all(
      groups.map(async (g) => {
        const gid = g.group_id;
        const [memRows, expRows, shareRows, payRows] = await Promise.all([
          c.env.DB.prepare(
            `SELECT gm.user_id, u.name, u.email
             FROM group_members gm JOIN users u ON u.id = gm.user_id
             WHERE gm.group_id = ?`
          )
            .bind(gid)
            .all<{
              user_id: string;
              name: string | null;
              email: string;
            }>(),
          c.env.DB.prepare(
            `SELECT id, paid_by_user_id, amount_minor, currency FROM expenses WHERE group_id = ?`
          )
            .bind(gid)
            .all<{ id: string; paid_by_user_id: string; amount_minor: number; currency: string }>(),
          c.env.DB.prepare(
            `SELECT es.expense_id, es.user_id, es.share_amount_minor
             FROM expense_shares es
             INNER JOIN expenses e ON e.id = es.expense_id
             WHERE e.group_id = ?
             ORDER BY es.expense_id, es.user_id`
          )
            .bind(gid)
            .all<{ expense_id: string; user_id: string; share_amount_minor: number }>(),
          c.env.DB.prepare(
            `SELECT id, from_user_id, to_user_id, amount_minor, currency FROM payments WHERE group_id = ?`
          )
            .bind(gid)
            .all<{ id: string; from_user_id: string; to_user_id: string; amount_minor: number; currency: string }>(),
        ]);

        const sharesByExpense = new Map<string, Array<{ user_id: string; share_amount_minor: number }>>();
        for (const r of shareRows.results ?? []) {
          const list = sharesByExpense.get(r.expense_id) ?? [];
          list.push({ user_id: r.user_id, share_amount_minor: r.share_amount_minor });
          sharesByExpense.set(r.expense_id, list);
        }

        const expensesOut: Array<{
          id: string;
          paidById: string;
          amount: string;
          currency: string;
          participants: Array<{ userId: string; amount: string }>;
        }> = (expRows.results ?? []).map((e) => {
          const parts = sharesByExpense.get(e.id) ?? [];
          return {
            id: e.id,
            paidById: e.paid_by_user_id,
            amount: minorToDisplayAmount(e.amount_minor).toFixed(2),
            currency: e.currency,
            participants: parts.map((p) => ({
              userId: p.user_id,
              amount: minorToDisplayAmount(p.share_amount_minor).toFixed(2),
            })),
          };
        });

        return {
          id: gid,
          name: g.name,
          description: g.description,
          category: g.category,
          currency: g.currency,
          members: (memRows.results ?? []).map((m) => ({
            id: m.user_id,
            userId: m.user_id,
            user: {
              id: m.user_id,
              name: m.name,
              email: m.email,
              avatarUrl: null,
            },
          })),
          expenses: expensesOut,
          settlements: (payRows.results ?? []).map((s) => ({
            id: s.id,
            fromId: s.from_user_id,
            toId: s.to_user_id,
            amount: minorToDisplayAmount(s.amount_minor).toFixed(2),
            currency: s.currency,
          })),
        };
      })
    );

    const dbMs = performance.now() - dbStart;
    const serializeStart = performance.now();
    const response = jsonOk({ groupsData });
    const serializeMs = performance.now() - serializeStart;
    return appendServerTiming(response, [
      { name: "db", durationMs: dbMs },
      { name: "serialize", durationMs: serializeMs },
      { name: "total", durationMs: performance.now() - totalStart },
    ]);
  });

  v1.get("/groups", async (c) => {
    const totalStart = performance.now();
    const uid = c.get("userId");
    const dbStart = performance.now();
    const mems = await c.env.DB.prepare(
      `SELECT gm.group_id, gm.role, g.name, g.description, g.category, g.currency, g.created_at, g.updated_at
       FROM group_members gm JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY gm.joined_at DESC`
    )
      .bind(uid)
      .all<{
        group_id: string;
        role: string;
        name: string;
        description: string | null;
        category: string;
        currency: string;
        created_at: string;
        updated_at: string;
      }>();
    const groups = await Promise.all(
      (mems.results ?? []).map(async (row) => {
        const gid = row.group_id;
        const [memRows, expRows, shareRows, setRows] = await Promise.all([
          c.env.DB.prepare(`SELECT user_id FROM group_members WHERE group_id = ?`).bind(gid).all<{ user_id: string }>(),
          c.env.DB
            .prepare(`SELECT id, paid_by_user_id, amount_minor FROM expenses WHERE group_id = ?`)
            .bind(gid)
            .all<{ id: string; paid_by_user_id: string; amount_minor: number }>(),
          c.env.DB
            .prepare(
              `SELECT es.expense_id, es.user_id, es.share_amount_minor
               FROM expense_shares es
               INNER JOIN expenses e ON e.id = es.expense_id
               WHERE e.group_id = ?
               ORDER BY es.expense_id, es.user_id`
            )
            .bind(gid)
            .all<{ expense_id: string; user_id: string; share_amount_minor: number }>(),
          c.env.DB
            .prepare(`SELECT from_user_id, to_user_id, amount_minor FROM payments WHERE group_id = ?`)
            .bind(gid)
            .all<{ from_user_id: string; to_user_id: string; amount_minor: number }>(),
        ]);
        const memberIds = (memRows.results ?? []).map((m) => m.user_id);
        const sharesByExpense = new Map<string, Array<{ user_id: string; share_amount_minor: number }>>();
        for (const r of shareRows.results ?? []) {
          const list = sharesByExpense.get(r.expense_id) ?? [];
          list.push({ user_id: r.user_id, share_amount_minor: r.share_amount_minor });
          sharesByExpense.set(r.expense_id, list);
        }
        const expensesData = (expRows.results ?? []).map((e) => ({
          paidById: e.paid_by_user_id,
          participants: (sharesByExpense.get(e.id) ?? []).map((p) => ({
            userId: p.user_id,
            amountMinor: p.share_amount_minor,
          })),
        }));
        const balancesMap = calculateBalancesMinor({
          memberIds,
          expenses: expensesData,
          settlements: (setRows.results ?? []).map((s) => ({
            fromId: s.from_user_id,
            toId: s.to_user_id,
            amountMinor: s.amount_minor,
          })),
        });
        const rawBal = balancesMap[uid] ?? 0;
        const yourBalance = minorToDisplayAmount(Math.round(rawBal));
        return {
          id: gid,
          name: row.name,
          description: row.description,
          category: row.category,
          currency: row.currency,
          role: row.role,
          memberCount: memberIds.length,
          expenseCount: expRows.results?.length ?? 0,
          yourBalance,
        };
      })
    );
    const dbMs = performance.now() - dbStart;
    const serializeStart = performance.now();
    const response = jsonOk({ groups });
    const serializeMs = performance.now() - serializeStart;
    return appendServerTiming(response, [
      { name: "db", durationMs: dbMs },
      { name: "serialize", durationMs: serializeMs },
      { name: "total", durationMs: performance.now() - totalStart },
    ]);
  });

  const createGroupBody = z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().min(1),
    currency: z.string().length(3).transform((s) => s.toUpperCase()),
  });

  v1.post("/groups", async (c) => {
    const uid = c.get("userId");
    const parsed = await parseJsonSafe(c.req.raw, createGroupBody);
    if (!parsed.ok) return jsonError(400, parsed.error);
    const gid = genRecordId();
    const t = nowIso();
    const desc = parsed.data.description ?? "";
    await c.env.DB.prepare(
      `INSERT INTO groups (id, name, description, category, currency, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(gid, parsed.data.name, desc, parsed.data.category, parsed.data.currency, uid, t, t)
      .run();
    const mid = genRecordId();
    await c.env.DB.prepare(
      `INSERT INTO group_members (id, group_id, user_id, role, joined_at) VALUES (?, ?, ?, 'admin', ?)`
    )
      .bind(mid, gid, uid, t)
      .run();
    await logActivity(c.env.DB, uid, gid, ACTIVITY_TYPES.GROUP_CREATED, { groupName: parsed.data.name });
    return jsonOk({ groupId: gid });
  });

  v1.get("/groups/:groupId", async (c) => {
    const uid = c.get("userId");
    const groupId = c.req.param("groupId");
    const m = await assertGroupMember(c.env.DB, uid, groupId);
    if (!m) return jsonError(403, "Forbidden.", "FORBIDDEN");
    const g = await c.env.DB.prepare(`SELECT * FROM groups WHERE id = ?`)
      .bind(groupId)
      .first<{
        id: string;
        name: string;
        description: string | null;
        category: string;
        currency: string;
        created_at: string;
        updated_at: string;
      }>();
    if (!g) return jsonError(404, "Not found.", "NOT_FOUND");
    return jsonOk({
      group: {
        id: g.id,
        name: g.name,
        description: g.description,
        category: g.category,
        currency: g.currency,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        role: m.role,
      },
    });
  });

  v1.delete("/groups/:groupId", async (c) => {
    const uid = c.get("userId");
    const groupId = c.req.param("groupId");
    const adm = await assertGroupAdmin(c.env.DB, uid, groupId);
    if (!adm) return jsonError(403, "Only admins can delete the group.", "FORBIDDEN");
    await c.env.DB.prepare(`DELETE FROM groups WHERE id = ?`).bind(groupId).run();
    await logActivity(c.env.DB, uid, groupId, ACTIVITY_TYPES.GROUP_DELETED, {});
    return jsonOk({ ok: true });
  });

  v1.get("/groups/:groupId/member-search", async (c) => {
    const uid = c.get("userId");
    const groupId = c.req.param("groupId");
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    if (!q) return jsonOk({ hits: [] });
    const m = await assertGroupMember(c.env.DB, uid, groupId);
    if (!m) return jsonError(403, "Forbidden.", "FORBIDDEN");
    const existing = await c.env.DB.prepare(`SELECT user_id FROM group_members WHERE group_id = ?`)
      .bind(groupId)
      .all<{ user_id: string }>();
    const memberSet = new Set((existing.results ?? []).map((r) => r.user_id));
    const like = `%${q.replace(/%/g, "\\%")}%`;
    const rows = await c.env.DB.prepare(
      `SELECT id, name, email FROM users
       WHERE id != ? AND (lower(email) LIKE ? OR lower(coalesce(name,'')) LIKE ?) LIMIT 24`
    )
      .bind(uid, like, like)
      .all<{ id: string; name: string | null; email: string }>();
    const hits = (rows.results ?? [])
      .filter((r) => !memberSet.has(r.id))
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: null,
      }));
    return jsonOk({ hits });
  });

  const addMemberBody = z.object({ email: z.string().email().transform((s) => s.trim().toLowerCase()) });

  v1.post("/groups/:groupId/members", async (c) => {
    const uid = c.get("userId");
    const groupId = c.req.param("groupId");
    const m = await assertGroupMember(c.env.DB, uid, groupId);
    if (!m) return jsonError(403, "Forbidden.", "FORBIDDEN");
    const parsed = await parseJsonSafe(c.req.raw, addMemberBody);
    if (!parsed.ok) return jsonError(400, parsed.error);
    const email = parsed.data.email;
    const target = await c.env.DB.prepare(`SELECT id, name, email FROM users WHERE lower(email) = lower(?)`)
      .bind(email)
      .first<{ id: string; name: string | null; email: string }>();
    if (target) {
      if (target.id === uid) {
        return jsonError(400, "You are already in this group.", "BAD_REQUEST");
      }
      const exists = await c.env.DB.prepare(
        `SELECT id FROM group_members WHERE group_id = ? AND user_id = ?`
      )
        .bind(groupId, target.id)
        .first<{ id: string }>();
      if (exists) {
        return jsonError(400, "User is already a member.", "BAD_REQUEST");
      }
      const mid = genRecordId();
      const t = nowIso();
      await c.env.DB.prepare(
        `INSERT INTO group_members (id, group_id, user_id, role, joined_at) VALUES (?, ?, ?, 'member', ?)`
      )
        .bind(mid, groupId, target.id, t)
        .run();
      await logActivity(c.env.DB, uid, groupId, ACTIVITY_TYPES.MEMBER_ADDED, {
        email: target.email,
        name: target.name,
      });
      return jsonOk({ ok: true, invited: false });
    }
    const iid = genRecordId();
    const t = nowIso();
    const exp = new Date();
    exp.setDate(exp.getDate() + 14);
    await c.env.DB.prepare(
      `INSERT INTO invitations (id, group_id, email, token, status, invited_by, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    )
      .bind(iid, groupId, email, crypto.randomUUID(), uid, exp.toISOString(), t, t)
      .run();
    return jsonOk({ ok: true, invited: true });
  });

  v1.delete("/groups/:groupId/members/:userId", async (c) => {
    const uid = c.get("userId");
    const groupId = c.req.param("groupId");
    const removeId = c.req.param("userId");
    const adm = await assertGroupAdmin(c.env.DB, uid, groupId);
    if (!adm) return jsonError(403, "Only admins can remove members.", "FORBIDDEN");
    if (removeId === uid) {
      return jsonError(400, "Use leave group instead (not implemented).", "BAD_REQUEST");
    }
    await c.env.DB.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`)
      .bind(groupId, removeId)
      .run();
    await logActivity(c.env.DB, uid, groupId, ACTIVITY_TYPES.MEMBER_REMOVED, { removedUserId: removeId });
    return jsonOk({ ok: true });
  });

  v1.get("/groups/:groupId/detail", async (c) => {
    const totalStart = performance.now();
    const dbStart = performance.now();
    const uid = c.get("userId");
    const groupId = c.req.param("groupId");
    const m = await assertGroupMember(c.env.DB, uid, groupId);
    if (!m) return jsonError(403, "Forbidden.", "FORBIDDEN");

    const g = await c.env.DB.prepare(`SELECT * FROM groups WHERE id = ?`).bind(groupId).first<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      currency: string;
    }>();
    if (!g) return jsonError(404, "Not found.", "NOT_FOUND");

    const [memRows, expRows, shareRowsResult, setRows] = await Promise.all([
      c.env.DB.prepare(
        `SELECT gm.id, gm.user_id, gm.role, u.name, u.email
         FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?`
      )
        .bind(groupId)
        .all<{
          id: string;
          user_id: string;
          role: string;
          name: string | null;
          email: string;
        }>(),
      c.env.DB.prepare(
        `SELECT e.id, e.paid_by_user_id, e.description, e.amount_minor, e.currency,
                e.original_amount_minor, e.original_currency, e.exchange_rate_e8,
                e.category, e.expense_date, e.notes, e.split_type, e.attachment_mime,
                payer.name as payer_name, payer.email as payer_email
         FROM expenses e
         JOIN users payer ON payer.id = e.paid_by_user_id
         WHERE e.group_id = ?
         ORDER BY e.expense_date DESC`
      )
        .bind(groupId)
        .all<{
          id: string;
          paid_by_user_id: string;
          description: string;
          amount_minor: number;
          currency: string;
          original_amount_minor: number | null;
          original_currency: string | null;
          exchange_rate_e8: number | null;
          category: string;
          expense_date: string;
          notes: string | null;
          split_type: string;
          attachment_mime: string | null;
          payer_name: string | null;
          payer_email: string;
        }>(),
      c.env.DB.prepare(
        `SELECT es.expense_id, es.id, es.user_id, es.share_amount_minor, es.shares, es.percentage_bps,
                u.name, u.email
         FROM expense_shares es
         INNER JOIN expenses e ON e.id = es.expense_id
         INNER JOIN users u ON u.id = es.user_id
         WHERE e.group_id = ?
         ORDER BY es.expense_id, es.id`
      )
        .bind(groupId)
        .all<{
          expense_id: string;
          id: string;
          user_id: string;
          share_amount_minor: number;
          shares: number | null;
          percentage_bps: number | null;
          name: string | null;
          email: string;
        }>(),
      c.env.DB.prepare(
        `SELECT p.id, p.from_user_id, p.to_user_id, p.amount_minor, p.currency, p.notes, p.paid_at,
                fu.name as fn, fu.email as fe, tu.name as tn, tu.email as te
         FROM payments p
         JOIN users fu ON fu.id = p.from_user_id
         JOIN users tu ON tu.id = p.to_user_id
         WHERE p.group_id = ?
         ORDER BY p.paid_at DESC`
      )
        .bind(groupId)
        .all<{
          id: string;
          from_user_id: string;
          to_user_id: string;
          amount_minor: number;
          currency: string;
          notes: string | null;
          paid_at: string;
          fn: string | null;
          fe: string;
          tn: string | null;
          te: string;
        }>(),
    ]);

    const memberRows = (memRows.results ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      name: row.name,
      email: row.email,
      avatarUrl: null,
    }));
    const memberIds = memberRows.map((x) => x.userId);

    type SharePart = {
      id: string;
      user_id: string;
      share_amount_minor: number;
      shares: number | null;
      percentage_bps: number | null;
      name: string | null;
      email: string;
    };
    const sharesByExpense = new Map<string, SharePart[]>();
    for (const r of shareRowsResult.results ?? []) {
      const list = sharesByExpense.get(r.expense_id) ?? [];
      list.push({
        id: r.id,
        user_id: r.user_id,
        share_amount_minor: r.share_amount_minor,
        shares: r.shares,
        percentage_bps: r.percentage_bps,
        name: r.name,
        email: r.email,
      });
      sharesByExpense.set(r.expense_id, list);
    }

    const expenses = (expRows.results ?? []).map((e) => {
      const plist = sharesByExpense.get(e.id) ?? [];
      return {
        id: e.id,
        description: e.description,
        amount: minorToDisplayAmount(e.amount_minor),
        currency: e.currency,
        originalAmount:
          e.original_amount_minor != null ? minorToDisplayAmount(e.original_amount_minor) : null,
        originalCurrency: e.original_currency,
        exchangeRate: e.exchange_rate_e8 != null ? e.exchange_rate_e8 / 1e8 : null,
        category: e.category,
        date: e.expense_date,
        notes: e.notes,
        attachmentFileName: e.attachment_mime ? "attachment" : null,
        splitMethod: e.split_type,
        paidById: e.paid_by_user_id,
        paidBy: {
          id: e.paid_by_user_id,
          name: e.payer_name,
          email: e.payer_email,
          avatarUrl: null,
        },
        participants: plist.map((p) => ({
          id: p.id,
          userId: p.user_id,
          amount: minorToDisplayAmount(p.share_amount_minor),
          shares: p.shares,
          percentage: p.percentage_bps != null ? p.percentage_bps / 100 : null,
          user: {
            id: p.user_id,
            name: p.name,
            email: p.email,
            avatarUrl: null,
          },
        })),
      };
    });

    const settlements = (setRows.results ?? []).map((s) => ({
      id: s.id,
      fromId: s.from_user_id,
      toId: s.to_user_id,
      amount: minorToDisplayAmount(s.amount_minor),
      currency: s.currency,
      notes: s.notes,
      settledAt: s.paid_at,
      from: {
        name: s.fn,
        email: s.fe,
        avatarUrl: null,
      },
      to: {
        name: s.tn,
        email: s.te,
        avatarUrl: null,
      },
    }));

    const balancesMap = calculateBalancesMinor({
      memberIds,
      expenses: expenses.map((e) => ({
        paidById: e.paidById,
        participants: e.participants.map((p) => ({
          userId: p.userId,
          amountMinor: Math.round(p.amount * 100),
        })),
      })),
      settlements: settlements.map((s) => ({
        fromId: s.fromId,
        toId: s.toId,
        amountMinor: Math.round(s.amount * 100),
      })),
    });

    const suggestions = minimizeDebtsMinor(balancesMap).map((s) => ({
      fromId: s.fromId,
      toId: s.toId,
      amount: minorToDisplayAmount(s.amountMinor),
      fromName:
        memberRows.find((m) => m.userId === s.fromId)?.name ??
        memberRows.find((m) => m.userId === s.fromId)?.email ??
        "",
      toName:
        memberRows.find((m) => m.userId === s.toId)?.name ??
        memberRows.find((m) => m.userId === s.toId)?.email ??
        "",
    }));

    const invs = await c.env.DB.prepare(
      `SELECT id, email, status, expires_at FROM invitations WHERE group_id = ? AND status = 'pending'`
    )
      .bind(groupId)
      .all<{ id: string; email: string | null; status: string; expires_at: string }>();

    const dbMs = performance.now() - dbStart;
    const serializeStart = performance.now();
    const response = jsonOk({
      detail: {
        role: m.role,
        currentUserId: uid,
        group: {
          id: g.id,
          name: g.name,
          description: g.description,
          category: g.category,
          currency: g.currency,
        },
        members: memberRows,
        invitations: (invs.results ?? []).map((i) => ({
          id: i.id,
          email: i.email,
          status: i.status,
          expiresAt: new Date(i.expires_at).toISOString(),
        })),
        expenses,
        balances: memberIds.map((mid) => {
          const row = memberRows.find((x) => x.userId === mid)!;
          return {
            userId: mid,
            name: row.name,
            email: row.email,
            balance: minorToDisplayAmount(balancesMap[mid] ?? 0),
          };
        }),
        suggestions,
        settlements,
      },
    });
    const serializeMs = performance.now() - serializeStart;
    return appendServerTiming(response, [
      { name: "db", durationMs: dbMs },
      { name: "serialize", durationMs: serializeMs },
      { name: "total", durationMs: performance.now() - totalStart },
    ]);
  });

  const expenseCreateBody = z.object({
    groupId: z.string().min(1),
    description: z.string().min(1),
    amountMinor: z.number().int().positive(),
    currency: z.string().length(3).transform((s) => s.toUpperCase()),
    category: z.string().min(1),
    date: z.string(),
    paidById: z.string().min(1),
    notes: z.string().nullable().optional(),
    splitMethod: z.enum(["equal", "exact", "percentage", "shares"]),
    participantIds: z.array(z.string()).min(1),
    originalAmountMinor: z.number().int().nullable().optional(),
    originalCurrency: z.string().nullable().optional(),
    exchangeRateE8: z.number().int().nullable().optional(),
    exactCents: z.record(z.string(), z.number().int()).optional(),
    percentages: z.record(z.string(), z.number()).optional(),
    shares: z.record(z.string(), z.number()).optional(),
    attachmentBase64: z.string().nullable().optional(),
    attachmentMime: z.string().nullable().optional(),
  });

  v1.post("/expenses", async (c) => {
    const uid = c.get("userId");
    const parsed = await parseJsonSafe(c.req.raw, expenseCreateBody);
    if (!parsed.ok) return jsonError(400, parsed.error);
    const d = parsed.data;
    const participantIds = [...new Set(d.participantIds)];
    if (participantIds.length < 1) {
      return jsonError(400, "At least one participant is required.", "BAD_REQUEST");
    }
    const mem = await assertGroupMember(c.env.DB, uid, d.groupId);
    if (!mem) return jsonError(403, "Not a member of this group.", "FORBIDDEN");

    const g = await c.env.DB.prepare(`SELECT currency FROM groups WHERE id = ?`)
      .bind(d.groupId)
      .first<{ currency: string }>();
    if (!g) return jsonError(404, "Group not found.", "NOT_FOUND");
    const groupCurrency = g.currency.toUpperCase();

    const memIds = await c.env.DB.prepare(`SELECT user_id FROM group_members WHERE group_id = ?`)
      .bind(d.groupId)
      .all<{ user_id: string }>();
    const set = new Set((memIds.results ?? []).map((m) => m.user_id));
    if (!set.has(uid)) return jsonError(403, "Forbidden.", "FORBIDDEN");
    for (const pid of participantIds) {
      if (!set.has(pid)) {
        return jsonError(400, "All participants must be group members.", "BAD_REQUEST");
      }
    }

    const split = calculateSplitMinor({
      method: d.splitMethod as SplitMethod,
      totalCents: d.amountMinor,
      participantIds,
      exactCents: d.exactCents,
      percentages: d.percentages,
      shares: d.shares,
    });
    if (!split.ok) return jsonError(400, split.error, "BAD_SPLIT");

    let attachmentBlob: ArrayBuffer | null = null;
    let attachmentMime: string | null = null;
    if (d.attachmentBase64 && d.attachmentMime) {
      const dec = decodeBase64ToArrayBuffer(d.attachmentBase64);
      if (!dec.ok) return jsonError(400, dec.error, "BAD_REQUEST");
      if (dec.buf.byteLength > MAX_EXPENSE_ATTACHMENT_BYTES) {
        return jsonError(400, MAX_EXPENSE_ATTACHMENT_ERROR, "ATTACHMENT_TOO_LARGE");
      }
      attachmentBlob = dec.buf;
      attachmentMime = d.attachmentMime;
    }

    const eid = genRecordId();
    const t = nowIso();
    const expParsed = expenseDateToIso(d.date);
    if (!expParsed.ok) return jsonError(400, "Invalid expense date.", "BAD_REQUEST");
    const expDate = expParsed.iso;

    await c.env.DB
      .prepare(
        `INSERT INTO expenses (id, group_id, paid_by_user_id, description, amount_minor, currency,
          original_amount_minor, original_currency, exchange_rate_e8, category, expense_date, notes, split_type,
          attachment_mime, attachment_blob, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        eid,
        d.groupId,
        d.paidById,
        d.description,
        d.amountMinor,
        groupCurrency,
        d.originalAmountMinor ?? null,
        d.originalCurrency ?? null,
        d.exchangeRateE8 ?? null,
        d.category,
        expDate,
        d.notes ?? null,
        d.splitMethod,
      attachmentMime,
      blobBindValue(attachmentBlob),
      uid,
      t,
      t
      )
      .run();

    for (const pid of participantIds) {
      const cents = split.centsByUser[pid] ?? 0;
      const shareId = genRecordId();
      let sharesVal: number | null = null;
      let pctBps: number | null = null;
      if (d.splitMethod === "shares" && d.shares?.[pid] != null) {
        sharesVal = Math.floor(d.shares[pid]!);
      }
      if (d.splitMethod === "percentage" && d.percentages?.[pid] != null) {
        pctBps = Math.round(d.percentages[pid]! * 100);
      }
      await c.env.DB.prepare(
        `INSERT INTO expense_shares (id, expense_id, user_id, share_amount_minor, shares, percentage_bps)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(shareId, eid, pid, cents, sharesVal, pctBps)
        .run();
    }

    await logActivity(c.env.DB, uid, d.groupId, ACTIVITY_TYPES.EXPENSE_ADDED, {
      expenseId: eid,
      description: d.description,
      amountMinor: d.amountMinor,
      currency: groupCurrency,
    });

    return jsonOk({ expenseId: eid });
  });

  const expenseUpdateBody = expenseCreateBody.merge(z.object({ expenseId: z.string().min(1) }));

  v1.patch("/expenses/:expenseId", async (c) => {
    const uid = c.get("userId");
    const expenseId = c.req.param("expenseId");
    const parsed = await parseJsonSafe(c.req.raw, expenseUpdateBody);
    if (!parsed.ok) return jsonError(400, parsed.error);
    const d = parsed.data;
    const participantIds = [...new Set(d.participantIds)];
    if (participantIds.length < 1) {
      return jsonError(400, "At least one participant is required.", "BAD_REQUEST");
    }
    if (d.expenseId !== expenseId) {
      return jsonError(400, "Mismatched expense id.", "BAD_REQUEST");
    }
    const exp = await c.env.DB.prepare(`SELECT group_id FROM expenses WHERE id = ?`)
      .bind(expenseId)
      .first<{ group_id: string }>();
    if (!exp) return jsonError(404, "Not found.", "NOT_FOUND");
    if (exp.group_id !== d.groupId) {
      return jsonError(400, "Expense does not belong to this group.", "BAD_REQUEST");
    }
    const mem = await assertGroupMember(c.env.DB, uid, d.groupId);
    if (!mem) return jsonError(403, "Forbidden.", "FORBIDDEN");

    const g = await c.env.DB.prepare(`SELECT currency FROM groups WHERE id = ?`)
      .bind(d.groupId)
      .first<{ currency: string }>();
    if (!g) return jsonError(404, "Group not found.", "NOT_FOUND");
    const groupCurrency = g.currency.toUpperCase();

    const memIds = await c.env.DB.prepare(`SELECT user_id FROM group_members WHERE group_id = ?`)
      .bind(d.groupId)
      .all<{ user_id: string }>();
    const set = new Set((memIds.results ?? []).map((m) => m.user_id));
    for (const pid of participantIds) {
      if (!set.has(pid)) {
        return jsonError(400, "All participants must be group members.", "BAD_REQUEST");
      }
    }

    const split = calculateSplitMinor({
      method: d.splitMethod as SplitMethod,
      totalCents: d.amountMinor,
      participantIds,
      exactCents: d.exactCents,
      percentages: d.percentages,
      shares: d.shares,
    });
    if (!split.ok) return jsonError(400, split.error, "BAD_SPLIT");

    await c.env.DB.prepare(`DELETE FROM expense_shares WHERE expense_id = ?`).bind(expenseId).run();

    let attachmentMime: string | null | undefined;
    let attachmentBlob: ArrayBuffer | null | undefined;
    const clearAtt = d.attachmentBase64 === "" && d.attachmentMime === "";
    if (clearAtt) {
      attachmentMime = null;
      attachmentBlob = null;
    } else if (d.attachmentBase64 && d.attachmentMime) {
      const dec = decodeBase64ToArrayBuffer(d.attachmentBase64);
      if (!dec.ok) return jsonError(400, dec.error, "BAD_REQUEST");
      if (dec.buf.byteLength > MAX_EXPENSE_ATTACHMENT_BYTES) {
        return jsonError(400, MAX_EXPENSE_ATTACHMENT_ERROR, "ATTACHMENT_TOO_LARGE");
      }
      attachmentBlob = dec.buf;
      attachmentMime = d.attachmentMime;
    }

    const t = nowIso();
    const expParsed = expenseDateToIso(d.date);
    if (!expParsed.ok) return jsonError(400, "Invalid expense date.", "BAD_REQUEST");
    const expDate = expParsed.iso;

    if (clearAtt || (d.attachmentBase64 && d.attachmentMime)) {
      await c.env.DB
        .prepare(
          `UPDATE expenses SET paid_by_user_id = ?, description = ?, amount_minor = ?, currency = ?,
            original_amount_minor = ?, original_currency = ?, exchange_rate_e8 = ?, category = ?, expense_date = ?,
            notes = ?, split_type = ?, attachment_mime = ?, attachment_blob = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          d.paidById,
          d.description,
          d.amountMinor,
          groupCurrency,
          d.originalAmountMinor ?? null,
          d.originalCurrency ?? null,
          d.exchangeRateE8 ?? null,
          d.category,
          expDate,
          d.notes ?? null,
          d.splitMethod,
          attachmentMime ?? null,
          blobBindValue(attachmentBlob ?? null),
          t,
          expenseId
        )
        .run();
    } else {
      await c.env.DB
        .prepare(
          `UPDATE expenses SET paid_by_user_id = ?, description = ?, amount_minor = ?, currency = ?,
            original_amount_minor = ?, original_currency = ?, exchange_rate_e8 = ?, category = ?, expense_date = ?,
            notes = ?, split_type = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          d.paidById,
          d.description,
          d.amountMinor,
          groupCurrency,
          d.originalAmountMinor ?? null,
          d.originalCurrency ?? null,
          d.exchangeRateE8 ?? null,
          d.category,
          expDate,
          d.notes ?? null,
          d.splitMethod,
          t,
          expenseId
        )
        .run();
    }

    for (const pid of participantIds) {
      const cents = split.centsByUser[pid] ?? 0;
      const shareId = genRecordId();
      let sharesVal: number | null = null;
      let pctBps: number | null = null;
      if (d.splitMethod === "shares" && d.shares?.[pid] != null) {
        sharesVal = Math.floor(d.shares[pid]!);
      }
      if (d.splitMethod === "percentage" && d.percentages?.[pid] != null) {
        pctBps = Math.round(d.percentages[pid]! * 100);
      }
      await c.env.DB.prepare(
        `INSERT INTO expense_shares (id, expense_id, user_id, share_amount_minor, shares, percentage_bps)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(shareId, expenseId, pid, cents, sharesVal, pctBps)
        .run();
    }

    await logActivity(c.env.DB, uid, d.groupId, ACTIVITY_TYPES.EXPENSE_UPDATED, {
      expenseId,
      description: d.description,
      amountMinor: d.amountMinor,
      currency: groupCurrency,
    });

    return jsonOk({ ok: true });
  });

  v1.delete("/expenses/:expenseId", async (c) => {
    const uid = c.get("userId");
    const expenseId = c.req.param("expenseId");
    const exp = await c.env.DB.prepare(`SELECT group_id, description FROM expenses WHERE id = ?`)
      .bind(expenseId)
      .first<{ group_id: string; description: string }>();
    if (!exp) return jsonError(404, "Not found.", "NOT_FOUND");
    const mem = await assertGroupMember(c.env.DB, uid, exp.group_id);
    if (!mem) return jsonError(403, "Forbidden.", "FORBIDDEN");

    await c.env.DB.prepare(`DELETE FROM expenses WHERE id = ?`).bind(expenseId).run();

    const remaining = await c.env.DB.prepare(`SELECT count(*) as c FROM expenses WHERE group_id = ?`)
      .bind(exp.group_id)
      .first<{ c: number }>();
    let clearedSettlements = false;
    if ((remaining?.c ?? 0) === 0) {
      await c.env.DB.prepare(`DELETE FROM payments WHERE group_id = ?`).bind(exp.group_id).run();
      clearedSettlements = true;
    }

    await logActivity(c.env.DB, uid, exp.group_id, ACTIVITY_TYPES.EXPENSE_DELETED, {
      expenseId,
      description: exp.description,
    });

    return jsonOk({ clearedSettlements, groupId: exp.group_id });
  });

  v1.get("/expenses/:expenseId/attachment", async (c) => {
    const uid = c.get("userId");
    const expenseId = c.req.param("expenseId");
    const exp = await c.env.DB.prepare(
      `SELECT group_id, attachment_mime, attachment_blob FROM expenses WHERE id = ?`
    )
      .bind(expenseId)
      .first<{
        group_id: string;
        attachment_mime: string | null;
        attachment_blob: ArrayBuffer | null;
      }>();
    if (!exp || !exp.attachment_blob || !exp.attachment_mime) {
      return new Response("Not found", { status: 404 });
    }
    const mem = await assertGroupMember(c.env.DB, uid, exp.group_id);
    if (!mem) return new Response("Forbidden", { status: 403 });
    return new Response(exp.attachment_blob, {
      status: 200,
      headers: {
        "content-type": exp.attachment_mime,
        "cache-control": "private, max-age=3600",
      },
    });
  });

  const settlementBody = z.object({
    groupId: z.string().min(1),
    fromId: z.string().min(1),
    toId: z.string().min(1),
    amountMinor: z.number().int().positive(),
    notes: z.string().nullable().optional(),
  });

  v1.post("/payments", async (c) => {
    const uid = c.get("userId");
    const parsed = await parseJsonSafe(c.req.raw, settlementBody);
    if (!parsed.ok) return jsonError(400, parsed.error);
    const d = parsed.data;
    if (d.fromId === d.toId) {
      return jsonError(400, "Cannot settle with yourself.", "BAD_REQUEST");
    }
    const mem = await assertGroupMember(c.env.DB, uid, d.groupId);
    if (!mem) return jsonError(403, "Not a member.", "FORBIDDEN");
    const ids = await c.env.DB.prepare(`SELECT user_id FROM group_members WHERE group_id = ?`)
      .bind(d.groupId)
      .all<{ user_id: string }>();
    const set = new Set((ids.results ?? []).map((r) => r.user_id));
    if (!set.has(d.fromId) || !set.has(d.toId)) {
      return jsonError(400, "Both parties must be group members.", "BAD_REQUEST");
    }
    const g = await c.env.DB.prepare(`SELECT currency FROM groups WHERE id = ?`)
      .bind(d.groupId)
      .first<{ currency: string }>();
    if (!g) return jsonError(404, "Group not found.", "NOT_FOUND");
    const pid = genRecordId();
    const t = nowIso();
    await c.env.DB.prepare(
      `INSERT INTO payments (id, group_id, from_user_id, to_user_id, amount_minor, currency, notes, paid_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        pid,
        d.groupId,
        d.fromId,
        d.toId,
        d.amountMinor,
        g.currency.toUpperCase(),
        d.notes ?? null,
        t,
        t,
        t
      )
      .run();
    await logActivity(c.env.DB, uid, d.groupId, ACTIVITY_TYPES.SETTLEMENT_RECORDED, {
      fromId: d.fromId,
      toId: d.toId,
      amountMinor: d.amountMinor,
    });
    return jsonOk({ paymentId: pid });
  });

  v1.get("/payments", async (c) => {
    const uid = c.get("userId");
    const mems = await c.env.DB.prepare(`SELECT group_id FROM group_members WHERE user_id = ?`)
      .bind(uid)
      .all<{ group_id: string }>();
    const gids = (mems.results ?? []).map((m) => m.group_id);
    if (gids.length === 0) return jsonOk({ settlements: [] });
    const placeholders = gids.map(() => "?").join(",");
    const rows = await c.env.DB.prepare(
      `SELECT p.*, g.name as group_name,
              fu.name as fn, fu.email as fe,
              tu.name as tn, tu.email as te
       FROM payments p
       JOIN groups g ON g.id = p.group_id
       JOIN users fu ON fu.id = p.from_user_id
       JOIN users tu ON tu.id = p.to_user_id
       WHERE p.group_id IN (${placeholders})
       ORDER BY p.paid_at DESC`
    )
      .bind(...gids)
      .all<{
        id: string;
        group_id: string;
        group_name: string;
        from_user_id: string;
        to_user_id: string;
        amount_minor: number;
        currency: string;
        notes: string | null;
        paid_at: string;
        fn: string | null;
        fe: string;
        tn: string | null;
        te: string;
      }>();
    return jsonOk({
      settlements: (rows.results ?? []).map((s) => ({
        id: s.id,
        groupId: s.group_id,
        groupName: s.group_name,
        currency: s.currency,
        amount: minorToDisplayAmount(s.amount_minor),
        notes: s.notes,
        settledAt: new Date(s.paid_at).toISOString(),
        from: { id: s.from_user_id, name: s.fn, email: s.fe },
        to: { id: s.to_user_id, name: s.tn, email: s.te },
        youPaid: s.from_user_id === uid,
        youReceived: s.to_user_id === uid,
      })),
    });
  });

  v1.get("/activity", async (c) => {
    const uid = c.get("userId");
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? "10") || 10));
    const mems = await c.env.DB.prepare(`SELECT group_id FROM group_members WHERE user_id = ?`)
      .bind(uid)
      .all<{ group_id: string }>();
    const gids = (mems.results ?? []).map((m) => m.group_id);
    const placeholders = gids.length ? gids.map(() => "?").join(",") : "";
    let query = `SELECT a.*, u.name as uname, u.email as uemail, g.name as gname
                 FROM activity_logs a
                 JOIN users u ON u.id = a.user_id
                 LEFT JOIN groups g ON g.id = a.group_id
                 WHERE (`;
    const binds: string[] = [uid];
    query += `a.user_id = ?`;
    if (gids.length) {
      query += ` OR a.group_id IN (${placeholders}))`;
      binds.push(...gids);
    } else {
      query += `)`;
    }
    query += ` ORDER BY a.created_at DESC LIMIT ?`;
    binds.push(String(limit));
    const rows = await c.env.DB.prepare(query)
      .bind(...binds)
      .all<{
        id: string;
        type: string;
        metadata_json: string | null;
        created_at: string;
        uname: string | null;
        uemail: string;
        gname: string | null;
        group_id: string | null;
      }>();
    return jsonOk({
      logs: (rows.results ?? []).map((l) => ({
        id: l.id,
        type: l.type,
        metadata: l.metadata_json ? (JSON.parse(l.metadata_json) as Record<string, unknown>) : null,
        createdAt: l.created_at,
        user: { name: l.uname, email: l.uemail },
        groupName: l.gname,
        groupId: l.group_id ?? null,
      })),
    });
  });

  v1.get("/reports", async (c) => {
    const totalStart = performance.now();
    const uid = c.get("userId");
    const groupId = c.req.query("groupId");
    const groupIdsCsv = c.req.query("groupIds");
    const dbStart = performance.now();
    const mems = await c.env.DB.prepare(
      `SELECT gm.group_id, g.name, g.currency FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ?`
    )
      .bind(uid)
      .all<{ group_id: string; name: string; currency: string }>();
    const all = mems.results ?? [];
    let selected = all;
    if (groupIdsCsv) {
      const allow = new Set(groupIdsCsv.split(",").map((s) => s.trim()).filter(Boolean));
      selected = all.filter((m) => allow.has(m.group_id));
    } else if (groupId) {
      selected = all.filter((m) => m.group_id === groupId);
    }
    const groupPicker = all.map((m) => ({ id: m.group_id, name: m.name, currency: m.currency }));

    const sections: unknown[] = [];
    let totalSpend = 0;
    let expenseCount = 0;
    const people = new Set<string>();

    for (const m of selected) {
      const gid = m.group_id;
      const [memRows, expRows, shareRowsResult, setRows] = await Promise.all([
        c.env.DB.prepare(
          `SELECT gm.user_id, u.name, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?`
        )
          .bind(gid)
          .all<{ user_id: string; name: string | null; email: string }>(),
        c.env.DB.prepare(
          `SELECT e.id, e.paid_by_user_id, e.description, e.amount_minor, e.currency,
                  e.original_amount_minor, e.original_currency, e.exchange_rate_e8,
                  e.category, e.expense_date, e.split_type,
                  payer.name as pname, payer.email as pemail
           FROM expenses e
           JOIN users payer ON payer.id = e.paid_by_user_id
           WHERE e.group_id = ?
           ORDER BY e.expense_date ASC`
        )
          .bind(gid)
          .all<{
            id: string;
            paid_by_user_id: string;
            description: string;
            amount_minor: number;
            currency: string;
            original_amount_minor: number | null;
            original_currency: string | null;
            exchange_rate_e8: number | null;
            category: string;
            expense_date: string;
            split_type: string;
            pname: string | null;
            pemail: string;
          }>(),
        c.env.DB.prepare(
          `SELECT es.expense_id, es.user_id, es.share_amount_minor, u.name, u.email FROM expense_shares es
           INNER JOIN expenses e ON e.id = es.expense_id
           INNER JOIN users u ON u.id = es.user_id
           WHERE e.group_id = ?
           ORDER BY es.expense_id, es.user_id`
        )
          .bind(gid)
          .all<{
            expense_id: string;
            user_id: string;
            share_amount_minor: number;
            name: string | null;
            email: string;
          }>(),
        c.env.DB.prepare(
          `SELECT p.id, p.from_user_id, p.to_user_id, p.amount_minor, p.paid_at, p.notes,
                fu.name as fn, fu.email as fe, tu.name as tn, tu.email as te FROM payments p
         JOIN users fu ON fu.id = p.from_user_id JOIN users tu ON tu.id = p.to_user_id
         WHERE p.group_id = ? ORDER BY p.paid_at DESC`
        )
          .bind(gid)
          .all<{
            id: string;
            from_user_id: string;
            to_user_id: string;
            amount_minor: number;
            paid_at: string;
            notes: string | null;
            fn: string | null;
            fe: string;
            tn: string | null;
            te: string;
          }>(),
      ]);

      const memberByUserId = new Map<string, { name: string | null; email: string }>(
        (memRows.results ?? []).map((r) => [r.user_id, { name: r.name, email: r.email }])
      );

      const sharesByExpense = new Map<
        string,
        Array<{ user_id: string; share_amount_minor: number; name: string | null; email: string }>
      >();
      for (const r of shareRowsResult.results ?? []) {
        const list = sharesByExpense.get(r.expense_id) ?? [];
        list.push({
          user_id: r.user_id,
          share_amount_minor: r.share_amount_minor,
          name: r.name,
          email: r.email,
        });
        sharesByExpense.set(r.expense_id, list);
      }

      const expensesOut: Array<{
        id: string;
        description: string;
        amount: string;
        currency: string;
        originalAmount: string | null;
        originalCurrency: string | null;
        exchangeRate: string | null;
        category: string;
        date: string;
        splitMethod: string;
        paidBy: { id: string; name: string | null; email: string };
        participants: Array<{ userId: string; amount: string; user: { email: string; name: string | null } }>;
      }> = [];

      const expensesForBalance: Array<{
        paidById: string;
        participants: Array<{ userId: string; amountMinor: number }>;
      }> = [];

      for (const e of expRows.results ?? []) {
        const parts = sharesByExpense.get(e.id) ?? [];
        expensesOut.push({
          id: e.id,
          description: e.description,
          amount: minorToDisplayAmount(e.amount_minor).toFixed(2),
          currency: e.currency,
          originalAmount:
            e.original_amount_minor != null ? minorToDisplayAmount(e.original_amount_minor).toFixed(2) : null,
          originalCurrency: e.original_currency,
          exchangeRate: e.exchange_rate_e8 != null ? (e.exchange_rate_e8 / 1e8).toFixed(8) : null,
          category: e.category,
          date: e.expense_date,
          splitMethod: e.split_type,
          paidBy: { id: e.paid_by_user_id, name: e.pname, email: e.pemail },
          participants: parts.map((p) => ({
            userId: p.user_id,
            amount: minorToDisplayAmount(p.share_amount_minor).toFixed(2),
            user: {
              email: p.email,
              name: p.name ?? memberByUserId.get(p.user_id)?.name ?? null,
            },
          })),
        });
        expensesForBalance.push({
          paidById: e.paid_by_user_id,
          participants: parts.map((p) => ({
            userId: p.user_id,
            amountMinor: p.share_amount_minor,
          })),
        });
        totalSpend += e.amount_minor;
        expenseCount += 1;
      }

      for (const r of memRows.results ?? []) people.add(r.user_id);

      const memberIds = (memRows.results ?? []).map((x) => x.user_id);
      const settlementsForBalance = (setRows.results ?? []).map((s) => ({
        fromId: s.from_user_id,
        toId: s.to_user_id,
        amountMinor: s.amount_minor,
      }));

      const balancesMap = calculateBalancesMinor({
        memberIds,
        expenses: expensesForBalance,
        settlements: settlementsForBalance,
      });

      const suggestions = minimizeDebtsMinor(balancesMap);

      sections.push({
        groupId: gid,
        name: m.name,
        currency: m.currency,
        expenses: expensesOut,
        balances: memberIds.map((mid) => {
          const mr = (memRows.results ?? []).find((x) => x.user_id === mid)!;
          return {
            userId: mid,
            name: mr.name,
            email: mr.email,
            balance: minorToDisplayAmount(balancesMap[mid] ?? 0),
            isYou: mid === uid,
          };
        }),
        suggestions: suggestions.map((s) => ({
          fromId: s.fromId,
          toId: s.toId,
          amount: minorToDisplayAmount(s.amountMinor),
          fromLabel:
            (memRows.results ?? []).find((x) => x.user_id === s.fromId)?.name ??
            (memRows.results ?? []).find((x) => x.user_id === s.fromId)?.email ??
            "",
          toLabel:
            (memRows.results ?? []).find((x) => x.user_id === s.toId)?.name ??
            (memRows.results ?? []).find((x) => x.user_id === s.toId)?.email ??
            "",
        })),
        settlements: (setRows.results ?? []).map((s) => ({
          id: s.id,
          fromId: s.from_user_id,
          toId: s.to_user_id,
          amount: minorToDisplayAmount(s.amount_minor),
          settledAt: new Date(s.paid_at).toISOString(),
          notes: s.notes,
          fromLabel: s.fn ?? s.fe,
          toLabel: s.tn ?? s.te,
          from: { email: s.fe, name: s.fn },
          to: { email: s.te, name: s.tn },
        })),
      });
    }

    const dbMs = performance.now() - dbStart;
    const serializeStart = performance.now();
    const response = jsonOk({
      groups: groupPicker,
      sections,
      summary: {
        totalSpend: totalSpend / 100,
        expenseCount,
        groupCount: selected.length,
        peopleCount: people.size,
      },
    });
    const serializeMs = performance.now() - serializeStart;
    return appendServerTiming(response, [
      { name: "db", durationMs: dbMs },
      { name: "serialize", durationMs: serializeMs },
      { name: "total", durationMs: performance.now() - totalStart },
    ]);
  });
}
