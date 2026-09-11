import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const cookieName = "finance_session";
const maxAge = 60 * 60 * 24 * 7;
function secret() { const value = process.env.AUTH_SESSION_SECRET; if (!value) throw new Error("AUTH_SESSION_SECRET is required."); return new TextEncoder().encode(value); }

export async function createSession(username: string) {
  const token = await new SignJWT({ authenticated: true, username }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
  const store = await cookies();
  store.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}
export async function getSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], requiredClaims: ["exp", "iat"] }); return payload.authenticated === true && payload.username === process.env.AUTH_USERNAME ? { username: String(payload.username) } : null; } catch { return null; }
}
export async function deleteSession() { (await cookies()).set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 }); }
