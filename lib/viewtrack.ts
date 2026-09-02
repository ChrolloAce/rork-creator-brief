// ViewTrack API client bits. Server-side only — never import from client code.
//
// Base URL is env-overridable so a local ViewTrack (http://localhost:4000/api/v1)
// can be pointed at without a code change. Default is production.

export const VT_BASE =
  process.env.VIEWTRACK_API_BASE?.replace(/\/+$/, "") ??
  "https://api-production-263b.up.railway.app/api/v1";

export function vtKey(): string | undefined {
  return process.env.VIEWTRACK_API_KEY;
}

export function vtFetch(path: string, key: string) {
  return fetch(`${VT_BASE}${path}`, {
    headers: { "x-api-key": key },
    cache: "no-store",
  });
}

// The videos endpoint returns a uuid (`id`) and the canonical url, but no
// platform-native id. VideoExample.id is that short id (it's what
// resolveShortId looks up), so recover it from the url.
export function videoIdFromUrl(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return v; // youtube.com/watch?v=...
    const segs = u.pathname.split("/").filter(Boolean);
    // .../reel/CODE, .../p/CODE, .../video/ID, .../status/ID, .../shorts/ID
    const marker = segs.findIndex((s) =>
      ["reel", "reels", "p", "video", "status", "shorts"].includes(s)
    );
    const id = marker >= 0 ? segs[marker + 1] : segs[segs.length - 1];
    return id || fallback;
  } catch {
    return fallback;
  }
}

// Write-side counterpart to vtFetch. ViewTrack answers with a
// { success, data } | { success, error } envelope; callers unwrap via vtJson.
export function vtPost(path: string, key: string, body: unknown) {
  return fetch(`${VT_BASE}${path}`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export type VtEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error?: { message?: string; code?: string } };

// Unwrap a ViewTrack envelope into { ok, data } | { ok:false, error, status }.
// ViewTrack puts real, user-facing reasons in error.message (quota reached,
// budget exhausted, duplicate name) — surface those verbatim rather than a
// generic "ViewTrack 4xx", since they tell the admin what to do next.
export async function vtJson<T>(
  res: Response
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  let body: VtEnvelope<T> | null = null;
  try {
    body = (await res.json()) as VtEnvelope<T>;
  } catch {
    // fall through to the status-only message
  }
  if (res.ok && body && body.success) return { ok: true, data: body.data };
  const msg =
    (body && !body.success && body.error?.message) || `ViewTrack ${res.status}`;
  return { ok: false, error: msg, status: res.status };
}
