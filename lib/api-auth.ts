// Bearer-token auth for the external read-only /api/v1/* surface.
// Distinct from the cookie-based admin auth (lib/admin-auth.ts).

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function getApiKey(): string | null {
  const k = process.env.SUPERBRIEF_API_KEY;
  return k && k.length > 0 ? k : null;
}

export function verifyApiRequest(req: Request): {
  ok: true;
} | {
  ok: false;
  status: number;
  error: string;
} {
  const expected = getApiKey();
  if (!expected) {
    return {
      ok: false,
      status: 500,
      error: "SUPERBRIEF_API_KEY is not configured on the server",
    };
  }
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) {
    return { ok: false, status: 401, error: "missing bearer token" };
  }
  if (!safeEqual(m[1].trim(), expected)) {
    return { ok: false, status: 401, error: "invalid api key" };
  }
  return { ok: true };
}
