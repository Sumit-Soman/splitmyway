import PocketBase from "pocketbase";
import { type NextRequest, NextResponse } from "next/server";
import { normalizePocketBaseUrl } from "./url";

const PROTECTED_PREFIXES = ["/dashboard", "/groups", "/settlements", "/reports", "/settings"];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

function getPbUrl() {
  return normalizePocketBaseUrl(process.env.POCKETBASE_URL);
}

function applyPbCookie(pb: PocketBase, response: NextResponse) {
  const cookieStr = pb.authStore.exportToCookie({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  const first = cookieStr.split(";")[0];
  const eq = first.indexOf("=");
  if (eq <= 0) return;
  const name = first.slice(0, eq);
  const value = first.slice(eq + 1);
  response.cookies.set(name, decodeURIComponent(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function updatePocketBaseSession(request: NextRequest) {
  const url = getPbUrl();
  if (!url) {
    return NextResponse.next({ request });
  }

  const pb = new PocketBase(url);
  pb.authStore.loadFromCookie(request.headers.get("cookie") ?? "");

  if (pb.authStore.isValid) {
    try {
      await pb.collection("users").authRefresh();
    } catch {
      pb.authStore.clear();
    }
  }

  const record = pb.authStore.record;
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthRoute = AUTH_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));

  if (isProtected && !record) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    const res = NextResponse.redirect(redirectUrl);
    applyPbCookie(pb, res);
    return res;
  }

  if (isAuthRoute && record) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    const res = NextResponse.redirect(redirectUrl);
    applyPbCookie(pb, res);
    return res;
  }

  const res = NextResponse.next({ request });
  applyPbCookie(pb, res);
  return res;
}
