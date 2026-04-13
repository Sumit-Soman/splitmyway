import { cookies } from "next/headers";

const COOKIE = "smw_token";

export async function setSessionToken(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionToken() {
  const store = await cookies();
  store.delete(COOKIE);
}
