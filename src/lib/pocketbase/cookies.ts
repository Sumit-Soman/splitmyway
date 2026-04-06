import type PocketBase from "pocketbase";
import { cookies } from "next/headers";

/** Persist PocketBase auth to Next.js cookies (pb_auth). */
export async function setPbAuthCookie(pb: PocketBase) {
  const raw = pb.authStore.exportToCookie({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  const first = raw.split(";")[0];
  const eq = first.indexOf("=");
  if (eq <= 0) return;
  const name = first.slice(0, eq);
  const value = first.slice(eq + 1);
  const cookieStore = await cookies();
  cookieStore.set(name, decodeURIComponent(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearPbAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("pb_auth");
}
