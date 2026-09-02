import { NextResponse } from "next/server";
import {
  failTranscript,
  getTranscripts,
  markTranscriptRunning,
  queueTranscripts,
  reclaimStaleTranscripts,
  saveTranscript,
} from "@/lib/db";
import { geminiKey, transcribeVideoUrl } from "@/lib/transcribe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Transcription runs in the background on the server, not inside the request,
// so a batch of twenty survives the admin closing the tab. The client POSTs a
// batch, then polls GET for status.

declare global {
  var __transcribeQueue: string[] | undefined;
  var __transcribeActive: number | undefined;
}

// Two at a time: enough to keep the pipeline busy, few enough that a batch
// cannot pin the container's memory with concurrent video buffers.
const CONCURRENCY = 2;

function pump() {
  const queue = globalThis.__transcribeQueue ?? [];
  while ((globalThis.__transcribeActive ?? 0) < CONCURRENCY && queue.length > 0) {
    const videoId = queue.shift()!;
    globalThis.__transcribeActive = (globalThis.__transcribeActive ?? 0) + 1;
    void work(videoId).finally(() => {
      globalThis.__transcribeActive = (globalThis.__transcribeActive ?? 1) - 1;
      pump();
    });
  }
}

async function work(videoId: string) {
  // markTranscriptRunning is the single-flight lock; if it returns false some
  // other pass already took this row.
  const claimed = await markTranscriptRunning(videoId);
  if (!claimed) return;
  const [row] = await getTranscripts([videoId]);
  if (!row?.url) {
    await failTranscript(videoId, "No source URL for this video");
    return;
  }
  try {
    const text = await transcribeVideoUrl(row.url);
    await saveTranscript(videoId, text);
  } catch (e) {
    await failTranscript(videoId, (e as Error).message);
  }
}

// GET /api/vt/transcribe?ids=a,b,c — saved transcripts + live status.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ ok: true, transcripts: [] });
  const transcripts = await getTranscripts(ids);
  return NextResponse.json({ ok: true, transcripts });
}

// POST /api/vt/transcribe — queue a batch. Returns immediately; poll GET.
export async function POST(req: Request) {
  if (!geminiKey()) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY is not set on this server" },
      { status: 500 }
    );
  }
  let body: {
    videos?: {
      videoId: string;
      url: string;
      platform?: string;
      creator?: string;
      caption?: string;
      views?: number;
    }[];
    force?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const videos = (body.videos ?? []).filter((v) => v?.videoId && v?.url);
  if (videos.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Select at least one video with a URL" },
      { status: 400 }
    );
  }
  if (videos.length > 40) {
    return NextResponse.json(
      { ok: false, error: "40 videos max per batch" },
      { status: 400 }
    );
  }

  await reclaimStaleTranscripts();
  const claimed = await queueTranscripts(videos, !!body.force);
  globalThis.__transcribeQueue = [
    ...(globalThis.__transcribeQueue ?? []),
    ...claimed,
  ];
  pump();

  const transcripts = await getTranscripts(videos.map((v) => v.videoId));
  return NextResponse.json({ ok: true, queued: claimed.length, transcripts });
}
