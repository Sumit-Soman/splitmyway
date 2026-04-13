import { type NextRequest, NextResponse } from "next/server";

/**
 * Clears an invalid session cookie (e.g. JWT `sub` no longer exists in D1 after a data migration)
 * and sends the user to sign-in again.
 */
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("reason", "session");
  const res = NextResponse.redirect(url);
  res.cookies.delete("smw_token");
  return res;
}
