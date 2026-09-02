import { NextResponse } from "next/server";
import { requireVtKey } from "../../_key";
import { vtFetch, vtJson } from "@/lib/viewtrack";

export const dynamic = "force-dynamic";

type VtVideoDetail = {
  id: string;
  url: string;
  platform: string;
  thumbnail?: string;
  title?: string;
  caption?: string;
  uploaderHandle?: string;
  metrics?: { views?: number; likes?: number; comments?: number; shares?: number };
  uploadDate?: string | null;
  transcription?: {
    status?: string;
    transcript?: string | null;
    language?: string | null;
    source?: string | null;
    segments?: { start?: number; text?: string }[] | null;
    wordCount?: number | null;
  };
};

// GET /api/vt/videos/:id — one video with its transcript block. ViewTrack
// transcribes lazily on first read, and only YouTube has a real captions
// source; everything else settles on "unavailable", which the UI explains and
// offers the AI breakdown for instead.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { key, denied } = requireVtKey();
  if (denied) return denied;
  const { id } = await params;
  const r = await vtJson<VtVideoDetail>(
    await vtFetch(`/videos/${encodeURIComponent(id)}`, key)
  );
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  const v = r.data;
  return NextResponse.json({
    ok: true,
    video: {
      id: v.id,
      url: v.url,
      platform: v.platform,
      thumbnail: v.thumbnail ?? null,
      title: v.title ?? "",
      caption: v.caption ?? "",
      creator: v.uploaderHandle ?? "",
      views: v.metrics?.views ?? 0,
      likes: v.metrics?.likes ?? 0,
      comments: v.metrics?.comments ?? 0,
      uploadDate: v.uploadDate ?? null,
      transcriptStatus: v.transcription?.status ?? "none",
      transcript: v.transcription?.transcript ?? null,
      transcriptSource: v.transcription?.source ?? null,
      wordCount: v.transcription?.wordCount ?? null,
    },
  });
}
