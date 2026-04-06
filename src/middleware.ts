import { type NextRequest } from "next/server";
import { updatePocketBaseSession } from "@/lib/pocketbase/middleware";

export async function middleware(request: NextRequest) {
  return updatePocketBaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
