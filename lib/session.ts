// Signed session token for creator accounts. Cookie value is
// "<userId>.<hmac(userId)>" so we can verify without a DB hit. Web Crypto so it
// works in both Node and edge.

const SECRET = () => process.env.ADMIN_PASSWORD ?? "sb-session-secret";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return toHex(sig);
}

export const SESSION_COOKIE = "sb-session";

export async function makeSessionToken(userId: string): Promise<string> {
  return `${userId}.${await hmac(userId)}`;
}

// Returns the userId if the token is valid, else null.
export async function readSessionToken(
  token: string | undefined
): Promise<string | null> {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await hmac(userId);
  return sig === expected ? userId : null;
}
