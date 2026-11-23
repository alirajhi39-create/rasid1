import crypto from "node:crypto";
import { cookies } from "next/headers";

// ============================================================
//  المصادقة: تشفير scrypt لكلمات المرور + جلسة JWT (HS256) في httpOnly cookie
// ============================================================

const SESSION_COOKIE = "rased_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 أيام
const SECRET =
  process.env.AUTH_SECRET || process.env.SESSION_SECRET || "rased-local-dev-secret-change-me";

// ---------- كلمة المرور ----------

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(plain, salt, 64, { N, r, p }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = stored.split(":");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(plain, salt, expected.length, { N: +N, r: +r, p: +p }, (err, key) =>
        err ? reject(err) : resolve(key)
      );
    });
    return crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

// ---------- جلسة JWT حقيقية (HS256) ----------

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export type SessionPayload = {
  sub: number;
  name: string;
  username: string;
  exp: number;
  iat: number;
};

export function createSessionToken(payload: Omit<SessionPayload, "exp" | "iat">): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + SESSION_MAX_AGE } satisfies SessionPayload)
  );
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const expected = sign(`${header}.${body}`);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_MAX_AGE,
};
