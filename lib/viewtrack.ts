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
