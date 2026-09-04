import { NextResponse } from "next/server";
import { listStudioClips, listStudioRenders } from "@/lib/db";
import { isYmd, publicStudioConfig, todayYmdUtc } from "@/lib/studio";
import { getHookVideos, getHookVideosByIds } from "@/lib/hook-videos";
import { ensureSchedule } from "@/lib/studio-plan";
import { kickStudioQueue } from "@/lib/studio-worker";
import { studioContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Everything the builder page needs for the signed-in creator: config, their
// demos, the shared clips, the reels, their videos. `?today=YYYY-MM-DD` is the
// creator's local date; it drives the auto-fill of the coming days.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await studioContext(slug);
  if (!ctx.ok) return ctx.res;
  const todayParam = new URL(req.url).searchParams.get("today");
  const today = isYmd(todayParam) ? todayParam : todayYmdUtc();
  // Polling this endpoint is also what wakes the queue after a restart.
  kickStudioQueue();
  // Keep the calendar stocked. Cheap when nothing is missing (one read).
  const fill = await ensureSchedule({
    slug,
    userId: ctx.viewer.id,
    config: ctx.config,
    isAdmin: ctx.viewer.isAdmin,
    today,
  }).catch((e) => ({ created: 0, reason: (e as Error).message }));
  const [demos, broll, examples, showcase, renders, library] = await Promise.all([
    listStudioClips(slug, { kind: "demo", userId: ctx.viewer.id }),
    listStudioClips(slug, { kind: "broll" }),
    listStudioClips(slug, { kind: "example" }),
    listStudioClips(slug, { kind: "showcase" }),
    listStudioRenders(slug, ctx.viewer.id),
    getHookVideos(slug),
  ]);
  // Curated study reels replace the library preview outright.
  const rawStudy = ctx.config.studyReelIds;
  const studyIds = (Array.isArray(rawStudy) ? rawStudy : []).filter((x): x is string => typeof x === "string" && x.length > 0);
  const study = studyIds.length > 0 ? await getHookVideosByIds(studyIds) : null;
  return NextResponse.json({
    ok: true,
    viewer: { id: ctx.viewer.id, name: ctx.viewer.name, email: ctx.viewer.email, isAdmin: ctx.viewer.isAdmin },
    config: publicStudioConfig(ctx.config),
    today,
    demos,
    broll: broll.filter((b) => b.status === "ready"),
    examples: examples.filter((e) => e.status === "ready"),
    // Finished videos, playable in "how to create".
    showcase: showcase.filter((e) => e.status === "ready"),
    renders,
    libraryCount: study ? study.length : library.length,
    library: study ?? library.slice(0, 12),
    filled: fill.created,
  });
}
