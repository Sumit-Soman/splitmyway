import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server-user";
import { workerFetchRaw } from "@/lib/worker/client";

/**
 * Proxies the Worker expense attachment after the session is verified in Next.js.
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
  const upstream = await workerFetchRaw(`/v1/expenses/${encodeURIComponent(expenseId)}/attachment`);

  if (upstream.status === 404) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (upstream.status === 403) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!upstream.ok) {
    return new NextResponse("Failed to load file", { status: 502 });
  }

  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("cache-control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: 200, headers });
}
