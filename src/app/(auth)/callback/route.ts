import { NextResponse } from "next/server";

/**
 * Legacy PocketBase email verification callback. Auth is handled by the Worker now.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.redirect(new URL("/login?notice=verify-legacy", request.url));
}
