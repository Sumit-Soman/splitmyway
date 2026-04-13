import { type NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt-server";

const PROTECTED_PREFIXES = ["/dashboard", "/groups", "/settlements", "/reports", "/settings"];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

export async function updateSessionGate(request: NextRequest) {
  const token = request.cookies.get("smw_token")?.value;
  const session = token ? await verifySessionToken(token) : null;
  const record = session ? { id: session.sub, email: session.email } : null;

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthRoute = AUTH_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));

  if (isProtected && !record) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthRoute && record) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({ request });
}
