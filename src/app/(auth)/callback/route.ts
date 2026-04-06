import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { normalizePocketBaseUrl } from "@/lib/pocketbase/url";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";
  const token = searchParams.get("token");

  const url = normalizePocketBaseUrl(process.env.POCKETBASE_URL);
  if (token && url) {
    const pb = new PocketBase(url);
    try {
      await pb.collection("users").confirmVerification(token);
    } catch {
      /* invalid or non-verification token — still redirect home */
    }
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/dashboard"}`);
}
