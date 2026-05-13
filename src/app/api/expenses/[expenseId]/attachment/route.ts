import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server-user";
import { workerFetchRaw } from "@/lib/worker/client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Proxies the Worker expense attachment after the session is verified in Next.js.
 *
 * Buffer with `arrayBuffer()` instead of piping `upstream.body`: streaming binary through
 * `NextResponse` is unreliable on some Node/Vercel runtimes and can yield empty responses.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ expenseId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { expenseId } = await context.params;
  /** Avoid opaque compressed / chunked edge cases Node→Worker for binary bodies. */
  const upstream = await workerFetchRaw(`/v1/expenses/${encodeURIComponent(expenseId)}/attachment`, {
    headers: { "Accept-Encoding": "identity" },
  });

  if (upstream.status === 401) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (upstream.status === 404) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (upstream.status === 403) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return new NextResponse(detail.trim() || "Failed to load file", { status: 502 });
  }

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength === 0) {
    return new NextResponse("Empty attachment", { status: 502 });
  }

  const headers = new Headers();
  const ct = (upstream.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim();
  headers.set("content-type", ct || "application/octet-stream");
  if (/^image\//i.test(ct) || /^application\/pdf$/i.test(ct)) {
    headers.set("content-disposition", "inline");
  }
  headers.set("cache-control", "private, no-store");

  return new NextResponse(buf, { status: 200, headers });
}
