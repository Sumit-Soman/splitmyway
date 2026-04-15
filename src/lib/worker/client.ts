import { cookies } from "next/headers";

export class WorkerApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "WorkerApiError";
  }
}

/**
 * Bracket access + runtime parse: avoids a stale/empty WORKER_API_URL being inlined at
 * `next build` when the var was added in Vercel only after the first deploy.
 */
function readWorkerApiUrlRaw(): string {
  const v = process.env["WORKER_API_URL"];
  if (typeof v !== "string") return "";
  return v
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

/** Valid origin only, e.g. https://splitmyway-api.x.workers.dev (no trailing slash). */
function workerOrigin(): string {
  let s = readWorkerApiUrlRaw().replace(/\/+$/, "");
  if (!s) {
    throw new Error("WORKER_API_URL is not set");
  }
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    throw new Error(`WORKER_API_URL is not a valid URL (check Vercel env). First chars: ${s.slice(0, 80)}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("WORKER_API_URL must start with http:// or https://");
  }
  return parsed.origin;
}

function workerAbsoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return new URL(p, `${workerOrigin()}/`).href;
}

function workerPerfEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.SPLITMYWAY_PERF === "1";
}

function summarizeServerTiming(header: string | null): string {
  if (!header) return "";
  return header
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [nameRaw, ...params] = segment.split(";");
      const name = nameRaw.trim();
      const dur = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("dur="))
        ?.slice(4);
      return dur ? `${name}=${dur}ms` : name;
    })
    .join(" ");
}

function logWorkerFetchTiming(path: string, startedAt: number, res: Response): void {
  if (!workerPerfEnabled()) return;
  const elapsed = performance.now() - startedAt;
  const serverTiming = summarizeServerTiming(res.headers.get("Server-Timing"));
  const timingPart = serverTiming ? ` | ${serverTiming}` : "";
  console.log(`[splitmyway:worker] ${path} status=${res.status} fetch=${elapsed.toFixed(1)}ms${timingPart}`);
}

type WorkerEnvelope<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

function parseWorkerResponseJson(text: string, status: number): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    const hint = text.trim().slice(0, 200).replace(/\s+/g, " ");
    throw new WorkerApiError(
      status,
      hint ? `Invalid JSON from API (${status}): ${hint}` : `Invalid JSON from API (${status}).`
    );
  }
}

export async function workerFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get("smw_token")?.value;
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const startedAt = performance.now();
  const res = await fetch(workerAbsoluteUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
  logWorkerFetchTiming(path, startedAt, res);
  return res;
}

export async function workerFetchJson<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("smw_token")?.value;
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const startedAt = performance.now();
  const res = await fetch(workerAbsoluteUrl(path), {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  logWorkerFetchTiming(path, startedAt, res);
  const text = await res.text();
  const parsed = parseWorkerResponseJson(text, res.status);
  const body = parsed as WorkerEnvelope<T> | null;
  if (!body || typeof body !== "object" || !("ok" in body)) {
    throw new WorkerApiError(res.status, "Unexpected API response");
  }
  if (!body.ok) {
    throw new WorkerApiError(res.status, body.error || res.statusText);
  }
  return body.data;
}

export async function workerPostPublicJson<T>(path: string, json: unknown): Promise<T> {
  const startedAt = performance.now();
  const res = await fetch(workerAbsoluteUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
    cache: "no-store",
  });
  logWorkerFetchTiming(path, startedAt, res);
  const text = await res.text();
  const parsed = parseWorkerResponseJson(text, res.status);
  const body = parsed as WorkerEnvelope<T> | null;
  if (!body || typeof body !== "object" || !("ok" in body)) {
    throw new WorkerApiError(res.status, "Unexpected API response");
  }
  if (!body.ok) {
    throw new WorkerApiError(res.status, body.error || res.statusText);
  }
  return body.data;
}

export async function workerFetchForm(path: string, formData: FormData, method: "POST" | "PATCH" = "POST") {
  const cookieStore = await cookies();
  const token = cookieStore.get("smw_token")?.value;
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const startedAt = performance.now();
  const res = await fetch(workerAbsoluteUrl(path), {
    method,
    headers,
    body: formData,
    cache: "no-store",
  });
  logWorkerFetchTiming(path, startedAt, res);
  const text = await res.text();
  const parsed = parseWorkerResponseJson(text, res.status);
  const body = parsed as WorkerEnvelope<unknown> | null;
  if (!body || typeof body !== "object" || !("ok" in body)) {
    throw new WorkerApiError(res.status, "Unexpected API response");
  }
  if (!body.ok) {
    throw new WorkerApiError(res.status, body.error || res.statusText);
  }
  return body.data;
}
