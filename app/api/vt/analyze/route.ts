import { NextResponse } from "next/server";
import { requireVtKey } from "../_key";
import { vtJson, vtPost } from "@/lib/viewtrack";

export const dynamic = "force-dynamic";
// The Gemini pass on ViewTrack's side can take the better part of a minute on
// a long video; the default serverless timeout would cut it off mid-flight.
export const maxDuration = 120;

export type VtAnalysis = {
  transcript?: string | null;
  summary?: string;
  hook?: string;
  tone?: string;
  pacing?: string;
  topics?: string[];
  whatWorked?: string[];
  suggestions?: string[];
  segments?: { timestamp?: string; text?: string }[];
  modelVersion?: string;
};

// POST /api/vt/analyze — ViewTrack's AI breakdown of one tracked video: hook,
// pacing, what worked, and a transcript it derives from the video itself.
// This is the transcript path for Instagram/TikTok, where platform captions
// don't exist. Results are cached per video on ViewTrack, so re-opening a
// video is free; `force` re-runs and re-bills.
export async function POST(req: Request) {
  const { key, denied } = requireVtKey();
  if (denied) return denied;
  let body: { videoId?: string; force?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.videoId) {
    return NextResponse.json(
      { ok: false, error: "videoId is required" },
      { status: 400 }
    );
  }
  const r = await vtJson<{ videoId: string; analysis: VtAnalysis }>(
    await vtPost("/analyze-video", key, {
      videoId: body.videoId,
      ...(body.force ? { force: true } : {}),
    })
  );
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true, analysis: r.data.analysis });
}
