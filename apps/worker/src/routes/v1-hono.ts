import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { HonoEnv } from "../types";
import { jsonError, jsonOk } from "../lib/errors";
import { signUserToken, verifyUserToken } from "../lib/jwt";
import { genRecordId, nowIso } from "../lib/ids";
import { registerDataRoutes } from "./v1-data";

const loginBody = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1),
});

const signupBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8),
});

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

function avatarDataUrl(mime: string | null, blob: ArrayBuffer | null): string | null {
  if (!mime || !blob || blob.byteLength === 0) return null;
  if (blob.byteLength > 512 * 1024) return null;
  const bytes = new Uint8Array(blob);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return `data:${mime};base64,${b64}`;
}

export const v1 = new Hono<HonoEnv>();

v1.post("/auth/login", async (c) => {
  const parsed = await parseJsonSafe(c.req.raw, loginBody);
  if (!parsed.ok) return jsonError(400, parsed.error);
  const { email, password } = parsed.data;
  const row = await c.env.DB.prepare(
    `SELECT id, email, password_hash, name, currency, avatar_mime, avatar_blob, created_at, updated_at
     FROM users WHERE lower(email) = lower(?)`
  )
    .bind(email)
    .first<{
      id: string;
      email: string;
      password_hash: string;
      name: string | null;
      currency: string;
      avatar_mime: string | null;
      avatar_blob: ArrayBuffer | null;
      created_at: string;
      updated_at: string;
    }>();
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return jsonError(401, "Invalid email or password.", "BAD_CREDENTIALS");
  }
  const token = await signUserToken(c.env, row.id, row.email);
  const avatarUrl = avatarDataUrl(row.avatar_mime, row.avatar_blob);
  return jsonOk({
    token,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      currency: (row.currency ?? "USD").toUpperCase(),
      avatarUrl,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

v1.post("/auth/signup", async (c) => {
  const parsed = await parseJsonSafe(c.req.raw, signupBody);
  if (!parsed.ok) return jsonError(400, parsed.error);
  const { name, email, password } = parsed.data;
  const exists = await c.env.DB.prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`)
    .bind(email)
    .first<{ id: string }>();
  if (exists) {
    return jsonError(409, "An account with that email already exists.", "EMAIL_TAKEN");
  }
  const id = genRecordId();
  const t = nowIso();
  const hash = bcrypt.hashSync(password, 10);
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, name, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'USD', ?, ?)`
  )
    .bind(id, email, hash, name, t, t)
    .run();
  const token = await signUserToken(c.env, id, email);
  return jsonOk({
    token,
    user: {
      id,
      email,
      name,
      currency: "USD",
      avatarUrl: null,
      createdAt: t,
      updatedAt: t,
    },
  });
});

v1.use("*", async (c, next) => {
  if (c.req.path === "/auth/login" || c.req.path === "/auth/signup") {
    await next();
    return;
  }
  const h = c.req.header("Authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (!token) {
    return jsonError(401, "Missing bearer token.", "UNAUTHENTICATED");
  }
  const session = await verifyUserToken(c.env, token);
  if (!session) {
    return jsonError(401, "Invalid or expired session.", "UNAUTHENTICATED");
  }
  c.set("userId", session.userId);
  c.set("userEmail", session.email);
  await next();
});

v1.get("/me", async (c) => {
  const uid = c.get("userId");
  const row = await c.env.DB.prepare(
    `SELECT id, email, name, currency, avatar_mime, avatar_blob, created_at, updated_at FROM users WHERE id = ?`
  )
    .bind(uid)
    .first<{
      id: string;
      email: string;
      name: string | null;
      currency: string;
      avatar_mime: string | null;
      avatar_blob: ArrayBuffer | null;
      created_at: string;
      updated_at: string;
    }>();
  if (!row) return jsonError(404, "User not found.", "NOT_FOUND");
  return jsonOk({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      currency: (row.currency ?? "USD").toUpperCase(),
      avatarUrl: avatarDataUrl(row.avatar_mime, row.avatar_blob),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

const profilePatch = z.object({
  name: z.string().min(1).max(120),
  currency: z.string().length(3).transform((s) => s.toUpperCase()),
});

v1.patch("/me", async (c) => {
  const uid = c.get("userId");
  const parsed = await parseJsonSafe(c.req.raw, profilePatch);
  if (!parsed.ok) return jsonError(400, parsed.error);
  const t = nowIso();
  await c.env.DB.prepare(`UPDATE users SET name = ?, currency = ?, updated_at = ? WHERE id = ?`)
    .bind(parsed.data.name, parsed.data.currency, t, uid)
    .run();
  return jsonOk({ ok: true });
});

const passwordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

v1.post("/me/password", async (c) => {
  const uid = c.get("userId");
  const parsed = await parseJsonSafe(c.req.raw, passwordBody);
  if (!parsed.ok) return jsonError(400, parsed.error);
  const row = await c.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .bind(uid)
    .first<{ password_hash: string }>();
  if (!row || !bcrypt.compareSync(parsed.data.currentPassword, row.password_hash)) {
    return jsonError(400, "Current password is incorrect.", "BAD_PASSWORD");
  }
  const hash = bcrypt.hashSync(parsed.data.newPassword, 10);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
    .bind(hash, nowIso(), uid)
    .run();
  const token = await signUserToken(c.env, uid, c.get("userEmail"));
  return jsonOk({ token });
});

v1.post("/me/avatar", async (c) => {
  const uid = c.get("userId");
  const ct = c.req.header("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return jsonError(400, "Expected multipart/form-data.", "BAD_REQUEST");
  }
  const form = await c.req.formData();
  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(400, "Missing avatar file.", "BAD_REQUEST");
  }
  if (file.size > 2 * 1024 * 1024) {
    return jsonError(400, "Image must be 2 MB or smaller.", "BAD_REQUEST");
  }
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(file.type)) {
    return jsonError(400, "Use JPEG, PNG, WebP, or GIF.", "BAD_REQUEST");
  }
  const buf = await file.arrayBuffer();
  const t = nowIso();
  await c.env.DB.prepare(
    `UPDATE users SET avatar_mime = ?, avatar_blob = ?, updated_at = ? WHERE id = ?`
  )
    .bind(file.type, buf, t, uid)
    .run();
  return jsonOk({ ok: true });
});

v1.delete("/me/avatar", async (c) => {
  const uid = c.get("userId");
  await c.env.DB.prepare(
    `UPDATE users SET avatar_mime = NULL, avatar_blob = NULL, updated_at = ? WHERE id = ?`
  )
    .bind(nowIso(), uid)
    .run();
  return jsonOk({ ok: true });
});

v1.get("/users/by-id/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, email, name, currency, avatar_mime, avatar_blob, created_at, updated_at FROM users WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      email: string;
      name: string | null;
      currency: string;
      avatar_mime: string | null;
      avatar_blob: ArrayBuffer | null;
      created_at: string;
      updated_at: string;
    }>();
  if (!row) return jsonError(404, "Not found.", "NOT_FOUND");
  return jsonOk({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      currency: (row.currency ?? "USD").toUpperCase(),
      avatarUrl: avatarDataUrl(row.avatar_mime, row.avatar_blob),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

registerDataRoutes(v1);
