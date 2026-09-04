import { NextResponse } from "next/server";
import { createStudioClip } from "@/lib/db";
import type { StudioClipKind } from "@/lib/studio";
import { ADMIN_VIEWER_ID } from "@/lib/studio-auth";
import { importClipFromUrl } from "@/lib/studio-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only. Pull a clip from a URL the server can reach (the R2 hook
// library, a public file), optionally trim it, and ingest it like an upload.
// POST { url, kind: "showcase"|"example"|"broll", startSec?, endSec?, label? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let body: { url?: string; kind?: string; startSec?: number; endSec?: number; label?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const url = (body.url ?? "").trim();
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: "url required" }, { status: 400 });
  const kind: StudioClipKind =
    body.kind === "example" ? "example" : body.kind === "broll" ? "broll" : "showcase";
  const startSec = Number.isFinite(body.startSec) ? Math.max(0, Number(body.startSec)) : 0;
  const endSec = Number.isFinite(body.endSec) ? Math.max(startSec + 0.5, Number(body.endSec)) : undefined;
  const filename = url.split("/").pop()?.split("?")[0] || "clip.mp4";
  const clip = await createStudioClip({
    briefSlug: slug,
    kind,
    userId: ADMIN_VIEWER_ID,
    label: (body.label ?? "").trim().slice(0, 80) || null,
    filename,
  });
  void importClipFromUrl({ clipId: clip.id, kind, url, startSec, endSec, filename });
  return NextResponse.json({ ok: true, clip });
}
