// Client-safe helper for video thumbnails.
//
// Never point an <img> straight at a TikTok/Instagram CDN url: those are signed
// and expire, so most of them 403 by the time anyone loads the page. Route them
// through /api/thumb, which snapshots the image while it is still alive and
// serves the snapshot from then on. See app/api/thumb/route.ts.

/** Local/relative urls and data uris are already stable; pass them through. */
function isLocal(url: string): boolean {
  return url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:");
}

export function thumbSrc(
  thumbnail?: string | null,
  postUrl?: string | null
): string {
  if (!thumbnail) return "/api/thumb"; // returns the placeholder
  if (isLocal(thumbnail)) return thumbnail;
  const p = new URLSearchParams({ u: thumbnail });
  // The post url is stable across ViewTrack re-scrapes, so it makes a better
  // cache key than the rotating CDN url.
  if (postUrl) p.set("v", postUrl);
  return `/api/thumb?${p.toString()}`;
}
