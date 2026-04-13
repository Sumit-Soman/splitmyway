import { type NextRequest } from "next/server";
import { updateSessionGate } from "@/lib/auth/middleware-session";

export async function middleware(request: NextRequest) {
  return updateSessionGate(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
