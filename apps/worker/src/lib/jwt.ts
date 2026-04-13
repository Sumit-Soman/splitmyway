import * as jose from "jose";
import type { Bindings } from "../types";

export async function signUserToken(
  env: Bindings,
  userId: string,
  email: string
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new jose.SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyUserToken(
  env: Bindings,
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret, { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!sub) return null;
    return { userId: sub, email };
  } catch {
    return null;
  }
}
