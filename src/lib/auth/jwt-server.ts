import * as jose from "jose";

export async function verifySessionToken(token: string): Promise<{ sub: string; email: string } | null> {
  const secret = process.env.WORKER_JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!sub) return null;
    return { sub, email };
  } catch {
    return null;
  }
}
