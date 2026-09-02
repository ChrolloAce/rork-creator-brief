import { NextResponse } from "next/server";
import { requireVtKey } from "../_key";
import { vtFetch, vtJson, vtPost } from "@/lib/viewtrack";

export const dynamic = "force-dynamic";

type VtVideo = {
  id: string;
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
  transcriptStatus?: string;
};

const PAGE = 100;

// GET /api/vt/videos?projectId=…&limit=… — top videos in one project, by views.
// Capped low on purpose: this feeds a research browser you skim, not the full
// pinning picker (which lives in /api/vt-search and pulls the whole history).
export async function GET(req: Request) {
  const { key, denied } = requireVtKey();
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "projectId is required" },
      { status: 400 }
    );
  }
  const limit = Math.min(Number(searchParams.get("limit") ?? 60) || 60, 300);
  const out: VtVideo[] = [];
  for (let page = 0; out.length < limit; page++) {
    const path =
      `/videos?projectId=${encodeURIComponent(projectId)}` +
      `&sortBy=views&sortOrder=desc&limit=${PAGE}&offset=${page * PAGE}`;
    const r = await vtJson<{
      videos?: VtVideo[];
      pagination?: { hasMore?: boolean };
    }>(await vtFetch(path, key));
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    }
    out.push(...(r.data.videos ?? []));
    if (!r.data.pagination?.hasMore) break;
  }
  const videos = out.slice(0, limit).map((v) => ({
    id: v.id,
    url: v.url,
    platform: v.platform,
    thumbnail: v.thumbnail,
    caption: (v.caption || v.title || "").replace(/\s+/g, " ").trim(),
    views: v.views ?? 0,
    likes: v.likes ?? 0,
    comments: v.comments ?? 0,
    uploadDate: v.uploadDate ?? null,
    creator: v.accountUsername,
    transcriptStatus: v.transcriptStatus ?? "none",
  }));
  return NextResponse.json({ ok: true, videos });
}

// POST /api/vt/videos — add one or more videos by URL to a project. Each URL
// is reported on individually so one bad link in a paste of twenty doesn't
// hide the nineteen that worked.
export async function POST(req: Request) {
  const { key, denied } = requireVtKey();
  if (denied) return denied;
  let body: { urls?: string[]; url?: string; projectId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json(
      { ok: false, error: "Pick a project first" },
      { status: 400 }
    );
  }
  const urls = (body.urls ?? (body.url ? [body.url] : []))
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Paste at least one link" },
      { status: 400 }
    );
  }
  if (urls.length > 40) {
    return NextResponse.json(
      { ok: false, error: "40 links max per batch — split the paste" },
      { status: 400 }
    );
  }
  // Sequential, not Promise.all: each add triggers a paid scrape on ViewTrack
  // and a parallel burst is what trips its daily-budget guard mid-batch.
  const results: { url: string; ok: boolean; error?: string; id?: string }[] = [];
  for (const url of urls) {
    const r = await vtJson<{ id?: string }>(
      await vtPost("/videos", key, { url, projectId: body.projectId })
    );
    results.push(
      r.ok ? { url, ok: true, id: r.data?.id } : { url, ok: false, error: r.error }
    );
  }
  return NextResponse.json({
    ok: true,
    results,
    added: results.filter((r) => r.ok).length,
  });
}
