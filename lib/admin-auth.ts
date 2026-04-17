// Web Crypto–based auth. Works in both Edge (middleware) and Node (route handlers).

const COOKIE_NAME = "rork-admin-session";
const TOKEN_PAYLOAD = "admin-ok";

function getSecret(): string {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD env var is not set");
  return s;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return bytesToHex(sig);
}

// Constant-time string compare
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function issueToken(): Promise<string> {
  return hmacHex(TOKEN_PAYLOAD, getSecret());
}

export async function verifyToken(raw: string | undefined): Promise<boolean> {
  if (!raw) return false;
  try {
    const expected = await issueToken();
    return safeEqual(raw, expected);
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export const adminCookieName = COOKIE_NAME;
