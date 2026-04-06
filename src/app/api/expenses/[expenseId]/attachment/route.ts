import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server-user";
import { getAdminPb } from "@/lib/pocketbase/admin";
import { findMembership } from "@/lib/pocketbase/queries";
import { fileFieldName, recordField } from "@/lib/pocketbase/record-field";

/**
 * Proxies PocketBase expense files so the browser can load them same-origin (cookies)
 * after membership is verified.
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
  const pb = await getAdminPb();
  let record: Record<string, unknown> & { id: string };
  try {
    record = (await pb.collection("expenses").getOne(expenseId)) as Record<string, unknown> & {
      id: string;
    };
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileName = fileFieldName(record, "attachment");
  if (!fileName) {
    return new NextResponse("Not found", { status: 404 });
  }

  const groupId = String(recordField(record, "group") ?? "");
  const mem = await findMembership(user.id, groupId);
  if (!mem) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = pb.files.getURL(record, fileName);
  const token = pb.authStore.token;
  const upstream = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse("Failed to load file", { status: 502 });
  }

  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cd = upstream.headers.get("content-disposition");
  if (cd) headers.set("content-disposition", cd);
  headers.set("cache-control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: 200, headers });
}
