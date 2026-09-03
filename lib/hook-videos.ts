import "server-only";
import { sql, ensureSchema } from "./db";

// Reference reels scraped from source accounts (scripts/scrape-hooks.py) and
// stored in Cloudflare R2. Rows are per-brief so each campaign curates its own
// pool. The scraper owns writes; the app only reads.
export type HookVideo = {
  id: string;
  platform: "instagram" | "youtube" | "upload";
  shortcode: string;
  account: string;
  url: string;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  postedAt: string | null;
  videoUrl: string;
  thumbUrl: string | null;
};

type Row = {
  id: string;
  platform: "instagram" | "youtube" | "upload";
  shortcode: string;
  account: string;
  url: string;
  caption: string | null;
  views: string | number | null;
  likes: string | number | null;
  comments: string | number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  posted_at: Date | null;
  video_url: string;
  thumb_url: string | null;
};

function num(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getHookVideos(briefSlug: string): Promise<HookVideo[]> {
  await ensureSchema();
  const rows = await sql<Row[]>`
    SELECT id, platform, shortcode, account, url, caption, views, likes,
           comments, duration, width, height, posted_at, video_url, thumb_url
    FROM hook_video
    WHERE brief_slug = ${briefSlug} AND hidden = false
    ORDER BY views DESC NULLS LAST, posted_at DESC NULLS LAST
  `;
  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    shortcode: r.shortcode,
    account: r.account,
    url: r.url,
    caption: r.caption,
    views: num(r.views),
    likes: num(r.likes),
    comments: num(r.comments),
    duration: r.duration,
    width: r.width,
    height: r.height,
    postedAt: r.posted_at ? r.posted_at.toISOString() : null,
    videoUrl: r.video_url,
    thumbUrl: r.thumb_url,
  }));
}

// Explicit picks by id, in the order given. Ignores `hidden` on purpose:
// a curated study reel can live outside the rotation pool.
export async function getHookVideosByIds(ids: string[]): Promise<HookVideo[]> {
  if (ids.length === 0) return [];
  await ensureSchema();
  const rows = await sql<Row[]>`
    SELECT id, platform, shortcode, account, url, caption, views, likes,
           comments, duration, width, height, posted_at, video_url, thumb_url
    FROM hook_video WHERE id = ANY(${ids})
  `;
  const by = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => by.get(id))
    .filter((r): r is Row => !!r)
    .map((r) => ({
      id: r.id, platform: r.platform, shortcode: r.shortcode, account: r.account, url: r.url,
      caption: r.caption, views: num(r.views), likes: num(r.likes), comments: num(r.comments),
      duration: r.duration, width: r.width, height: r.height,
      postedAt: r.posted_at ? r.posted_at.toISOString() : null,
      videoUrl: r.video_url, thumbUrl: r.thumb_url,
    }));
}

export async function getHookVideo(id: string): Promise<HookVideo | null> {
  await ensureSchema();
  const rows = await sql<Row[]>`
    SELECT id, platform, shortcode, account, url, caption, views, likes,
           comments, duration, width, height, posted_at, video_url, thumb_url
    FROM hook_video WHERE id = ${id}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id, platform: r.platform, shortcode: r.shortcode, account: r.account, url: r.url,
    caption: r.caption, views: num(r.views), likes: num(r.likes), comments: num(r.comments),
    duration: r.duration, width: r.width, height: r.height,
    postedAt: r.posted_at ? r.posted_at.toISOString() : null,
    videoUrl: r.video_url, thumbUrl: r.thumb_url,
  };
}

// One-line label for a reel, used as the render's hook text and caption seed.
export function hookVideoLine(v: HookVideo): string {
  const first = (v.caption ?? "").split(/\r?\n/)[0].trim();
  return (first || `@${v.account}`).slice(0, 240);
}
