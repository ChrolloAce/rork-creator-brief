// Cookie-based per-brief access gate. No accounts — a shared passcode entered
// at the end of onboarding sets a signed cookie that the brief pages verify.
// Web Crypto so it works in both Node route handlers and (if needed) edge.

const SECRET = () => process.env.ADMIN_PASSWORD ?? "sb-creator-access";

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

export function accessCookieName(slug: string): string {
  return `sb-access-${slug.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

// Token bound to the brief + its current code, so rotating the code (or a wrong
// code) invalidates access.
export async function accessToken(slug: string, code: string): Promise<string> {
  return hmac(`${slug}::${code}`);
}

export async function isAccessTokenValid(
  slug: string,
  code: string,
  cookieValue: string | undefined
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await accessToken(slug, code);
  return cookieValue === expected;
}
