import { NextResponse } from "next/server";
import { listStudioClips, listStudioRenders } from "@/lib/db";
import { publicStudioConfig } from "@/lib/studio";
import { getHookVideos } from "@/lib/hook-videos";
import { kickStudioQueue } from "@/lib/studio-worker";
import { studioContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Everything the builder page needs for the signed-in creator: config, their
// demos, the shared background clips, their renders.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await studioContext(slug);
  if (!ctx.ok) return ctx.res;
  // Polling this endpoint is also what wakes the queue after a restart.
  kickStudioQueue();
  const [demos, broll, examples, renders, library] = await Promise.all([
    listStudioClips(slug, { kind: "demo", userId: ctx.viewer.id }),
    listStudioClips(slug, { kind: "broll" }),
    listStudioClips(slug, { kind: "example" }),
    listStudioRenders(slug, ctx.viewer.id),
    getHookVideos(slug),
  ]);
  return NextResponse.json({
    ok: true,
    viewer: { id: ctx.viewer.id, name: ctx.viewer.name, email: ctx.viewer.email, isAdmin: ctx.viewer.isAdmin },
    config: publicStudioConfig(ctx.config),
    demos,
    broll: broll.filter((b) => b.status === "ready"),
    // Admin "what a good demo looks like" clips, shown in step 1.
    examples: examples.filter((e) => e.status === "ready"),
    renders,
    // The hook library: size (gates the "library" opening) plus the top reels
    // by views for the "reels to study" strip in step 1.
    libraryCount: library.length,
    library: library.slice(0, 12),
  });
}
