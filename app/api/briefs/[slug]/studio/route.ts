import { NextResponse } from "next/server";
import { getCuration, listStudioClips, listStudioRenders, listStudioUsers } from "@/lib/db";
import { STUDIO_DEFAULTS, scheduleSettings } from "@/lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only (middleware gates /api/briefs/*): the Video Builder dashboard.
// Every creator on the brief with their demos, readiness and scheduled
// videos, plus the shared background/example clips.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const [cur, users, clips, renders] = await Promise.all([
      getCuration(slug),
      listStudioUsers(slug),
      listStudioClips(slug),
      listStudioRenders(slug),
    ]);
    const cfg = cur.studio ?? { hooks: [] };
    const minDemos = Math.max(1, cfg.minDemos ?? STUDIO_DEFAULTS.minDemos);
    const creators = users.map((u) => {
      const demos = clips.filter((c) => c.kind === "demo" && c.userId === u.id);
      const readyDemos = demos.filter((d) => d.status === "ready").length;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        demos,
        readyDemos,
        ready: readyDemos >= minDemos,
        renders: renders.filter((r) => r.userId === u.id),
      };
    });
    return NextResponse.json({
      ok: true,
      minDemos,
      schedule: scheduleSettings(cfg),
      creators,
      // Kept for the clip sections of the admin tab.
      clips: clips.filter((c) => c.kind !== "demo"),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
