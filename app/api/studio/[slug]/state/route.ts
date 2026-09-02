import { NextResponse } from "next/server";
import { listStudioClips, listStudioRenders } from "@/lib/db";
import { publicStudioConfig, studioOpening } from "@/lib/studio";
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
  const [demos, broll, renders, library] = await Promise.all([
    listStudioClips(slug, { kind: "demo", userId: ctx.viewer.id }),
    listStudioClips(slug, { kind: "broll" }),
    listStudioRenders(slug, ctx.viewer.id),
    studioOpening(ctx.config) === "library" ? getHookVideos(slug) : Promise.resolve([]),
  ]);
  return NextResponse.json({
    ok: true,
    viewer: { id: ctx.viewer.id, name: ctx.viewer.name, email: ctx.viewer.email, isAdmin: ctx.viewer.isAdmin },
    config: publicStudioConfig(ctx.config),
    demos,
    broll: broll.filter((b) => b.status === "ready"),
    renders,
    // Size of the hook library when the opening is "library" (0 otherwise).
    libraryCount: library.length,
  });
}
