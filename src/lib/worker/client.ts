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

function workerBase(): string {
  const base = process.env.WORKER_API_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("WORKER_API_URL is not set");
  }
  return base;
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
  return fetch(`${workerBase()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: "no-store",
  });
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
  const res = await fetch(`${workerBase()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
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
  const res = await fetch(`${workerBase()}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
    cache: "no-store",
  });
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
  const res = await fetch(`${workerBase()}${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    headers,
    body: formData,
    cache: "no-store",
  });
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
