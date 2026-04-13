import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import type { Bindings } from "./types";
import { MAX_EXPENSE_ATTACHMENT_ERROR } from "./lib/limits";
import { v1 } from "./routes/v1-hono";

const app = new Hono<{ Bindings: Bindings }>();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error("[splitmyway-api]", err);
  const detail =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Internal server error.";
  if (/TOOBIG|string or blob too big/i.test(detail)) {
    return Response.json(
      { ok: false as const, error: MAX_EXPENSE_ATTACHMENT_ERROR, code: "ATTACHMENT_TOO_LARGE" },
      { status: 400 }
    );
  }
  const safe = detail.length > 600 ? `${detail.slice(0, 600)}…` : detail;
  return Response.json({ ok: false as const, error: safe, code: "INTERNAL" }, { status: 500 });
});

app.use("*", async (c, next) => {
  const raw = c.env.CORS_ORIGINS ?? "http://localhost:3000";
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const mw = cors({
    origin: allowed.length ? allowed : ["http://localhost:3000"],
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Type"],
  });
  return await mw(c, next);
});

app.get("/health", (c) => c.text("ok"));
app.route("/v1", v1);

export default app;
