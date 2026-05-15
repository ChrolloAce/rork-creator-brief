import { NextResponse } from "next/server";
import type { CachedVideo } from "@/lib/db";

export const dynamic = "force-dynamic";

type VtVideo = {
  id: string;
  videoId: string;
  url: string;
  platform: "instagram" | "tiktok" | "x" | "youtube";
  caption?: string;
  title?: string;
  thumbnail: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  uploadDate?: string;
  accountUsername: string;
};

const PAGE_LIMIT = 100;
// 2000 videos per project — covers most projects' full history. The
// underlying ViewTrack endpoint sorts by views desc, so increasing this
// catches lower-view (often older) videos that previously fell off.
const MAX_PAGES = 20;

async function fetchProjectVideos(
  key: string,
  projectId: string
): Promise<VtVideo[]> {
  const out: VtVideo[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `https://viewtrack.app/api/v1/videos?projectId=${encodeURIComponent(
      projectId
    )}&sortBy=views&sortOrder=desc&limit=${PAGE_LIMIT}&offset=${page * PAGE_LIMIT}`;
    const res = await fetch(url, {
      headers: { "x-api-key": key },
      cache: "no-store",
    });
    if (!res.ok) break;
    const body = (await res.json()) as {
      data?: { videos?: VtVideo[]; pagination?: { hasMore?: boolean } };
    };
    const vids = body.data?.videos ?? [];
    out.push(...vids);
    if (!body.data?.pagination?.hasMore) break;
  }
  return out;
}

function platformPrefix(platform: VtVideo["platform"]): string {
  return platform === "instagram"
    ? "instagram.com/"
    : platform === "tiktok"
      ? "tiktok.com/@"
      : "x.com/";
}

export async function GET(req: Request) {
  const key = process.env.VIEWTRACK_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "VIEWTRACK_API_KEY not set" },
      { status: 500 }
    );
  }
  const { searchParams } = new URL(req.url);
  const projects = (searchParams.get("projects") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (projects.length === 0) {
    return NextResponse.json({ ok: true, videos: [] });
  }

  try {
    const perProject = await Promise.all(
      projects.map((id) => fetchProjectVideos(key, id))
    );
    const seen = new Set<string>();
    const merged: CachedVideo[] = [];
    for (const list of perProject) {
      for (const v of list) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        merged.push({
          platform: v.platform,
          url: v.url,
          id: v.videoId,
          dbId: v.id,
          thumbnail: v.thumbnail,
          caption: (v.caption || v.title || "").replace(/\s+/g, " ").trim(),
          views: v.views,
          likes: v.likes,
          comments: v.comments,
          shares: v.shares,
          uploadDate: v.uploadDate,
          creator: `@${v.accountUsername}`,
          creatorUrl: `https://${platformPrefix(v.platform)}${v.accountUsername}`,
        });
      }
    }
    merged.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    return NextResponse.json({ ok: true, videos: merged });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
