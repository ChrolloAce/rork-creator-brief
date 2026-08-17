import crypto from "crypto";
import { getThumb, putThumb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Why this exists:
//
// TikTok and Instagram hand out *signed, expiring* CDN urls for thumbnails.
// Measured against the live Prayer Lock pool: TikTok urls are dead within
// hours (100% 403 even on videos re-scraped two days earlier) and Instagram
// urls last roughly four days. ViewTrack stores whatever url it saw at scrape
// time, so by the time anyone opens the picker most thumbnails 403 and the
// grid renders empty.
//
// So: proxy every thumbnail through here, snapshot the bytes the first time we
// catch one alive, and serve from that snapshot forever after. Two extra
// recoveries make the hit rate much better than "whatever is still alive":
//
//   - TikTok publishes a keyless oEmbed endpoint that returns a freshly signed
//     thumbnail url, so a dead TikTok thumbnail can always be recovered.
//   - Instagram has no such endpoint (its /embed/ page is locked down for
//     logged-out requests), so a dead Instagram thumbnail stays dead until
//     ViewTrack next refreshes that video. We serve a placeholder with a short
//     cache so it heals on its own once that happens.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const OUT_WIDTH = 480; // renders at ~80-200px; 480 covers retina with room
const FETCH_TIMEOUT_MS = 12_000;

const IMMUTABLE = "public, max-age=31536000, immutable";
const RETRY_SOON = "public, max-age=900"; // placeholder: try again in 15 min

/** In-flight dedupe: a grid paints ~50 thumbnails at once. */
const inflight = new Map<string, Promise<CachedThumb | null>>();

type CachedThumb = { mime: string; bytes: Buffer };

function keyFor(thumbUrl: string, postUrl: string | null): string {
  // Prefer the post url: it is stable, so the snapshot survives ViewTrack
  // re-scraping the video and producing a different CDN url.
  return crypto.createHash("sha1").update(postUrl || thumbUrl).digest("hex");
}

async function timedFetch(url: string, referer?: string): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctl.signal,
      cache: "no-store",
      headers: referer ? { "User-Agent": UA, Referer: referer } : { "User-Agent": UA },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** TikTok's public oEmbed re-signs the thumbnail url. No auth needed. */
async function tiktokFreshThumb(postUrl: string): Promise<string | null> {
  const res = await timedFetch(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`
  );
  if (!res || !res.ok) return null;
  try {
    const j = (await res.json()) as { thumbnail_url?: unknown };
    return typeof j.thumbnail_url === "string" && j.thumbnail_url
      ? j.thumbnail_url
      : null;
  } catch {
    return null;
  }
}

async function downloadImage(url: string): Promise<CachedThumb | null> {
  const referer = url.includes("tiktokcdn")
    ? "https://www.tiktok.com/"
    : "https://www.instagram.com/";
  const res = await timedFetch(url, referer);
  if (!res || !res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return null;
  const raw = Buffer.from(await res.arrayBuffer());
  if (!raw.length || raw.length > MAX_SOURCE_BYTES) return null;

  // Downscale before storing. Originals run 30-100 KB each and this pool has
  // thousands of videos; WebP at 480px puts them around 10-15 KB, which keeps
  // the table small enough to never become a storage problem.
  try {
    const { default: sharp } = await import("sharp");
    const out = await sharp(raw)
      .rotate()
      .resize({ width: OUT_WIDTH, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
    if (out.length) return { mime: "image/webp", bytes: out };
  } catch {
    // sharp missing or the image is something it cannot read: store as-is
  }
  return { mime: type.split(";")[0], bytes: raw };
}

async function resolve(
  key: string,
  thumbUrl: string,
  postUrl: string | null
): Promise<CachedThumb | null> {
  const hit = await getThumb(key);
  if (hit) return hit;

  let img = await downloadImage(thumbUrl);
  let source = thumbUrl;

  // Stored url expired. TikTok can be re-signed on demand.
  if (!img && postUrl && /tiktok\.com/i.test(postUrl)) {
    const fresh = await tiktokFreshThumb(postUrl);
    if (fresh) {
      img = await downloadImage(fresh);
      source = fresh;
    }
  }
  if (!img) return null;

  try {
    await putThumb(key, img.mime, img.bytes, source);
  } catch {
    // Caching is best effort; still serve the image we just fetched.
  }
  return img;
}

function placeholder(): Response {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160">',
    '<rect width="120" height="160" fill="#e7e3da"/>',
    '<path d="M52 66l26 14-26 14z" fill="#b6afa2"/>',
    "</svg>",
  ].join("");
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": RETRY_SOON },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const thumbUrl = searchParams.get("u") ?? "";
  const postUrl = searchParams.get("v");

  if (!/^https?:\/\//i.test(thumbUrl)) return placeholder();

  const key = keyFor(thumbUrl, postUrl);

  let job = inflight.get(key);
  if (!job) {
    job = resolve(key, thumbUrl, postUrl).finally(() => inflight.delete(key));
    inflight.set(key, job);
  }

  let img: CachedThumb | null = null;
  try {
    img = await job;
  } catch {
    img = null;
  }
  if (!img) return placeholder();

  return new Response(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.mime,
      "Content-Length": String(img.bytes.length),
      "Cache-Control": IMMUTABLE,
    },
  });
}
