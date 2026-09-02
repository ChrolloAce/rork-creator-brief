import { NextResponse } from "next/server";
import { getCuration, listStudioClips, listStudioUsers } from "@/lib/db";
import { isYmd, todayYmdUtc } from "@/lib/studio";
import { createPlannedRender, ensureSchedule, isReadyCreator, loadPlanContext } from "@/lib/studio-plan";
import { kickStudioQueue } from "@/lib/studio-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only. Two shapes:
//   { mode: "fill", today }                         top up every ready creator
//   { mode: "add", userIds, days, count?, today }   N extra videos per day for
//                                                   the given creators
// Both use the same picker as the creator's own Generate button.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let body: { mode?: string; today?: string; userIds?: string[]; days?: string[]; count?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const today = isYmd(body.today) ? body.today : todayYmdUtc();
  const cur = await getCuration(slug);
  const config = { ...(cur.studio ?? { hooks: [] }), hooks: cur.studio?.hooks ?? [] };

  if (body.mode === "fill") {
    const users = await listStudioUsers(slug);
    const results: Record<string, { created: number; reason?: string }> = {};
    let total = 0;
    for (const u of users) {
      const r = await ensureSchedule({ slug, userId: u.id, config, isAdmin: true, today, force: true });
      results[u.id] = r;
      total += r.created;
    }
    if (total > 0) kickStudioQueue();
    return NextResponse.json({ ok: true, created: total, results });
  }

  if (body.mode === "add") {
    const userIds = Array.isArray(body.userIds) ? body.userIds.filter((x) => typeof x === "string") : [];
    const days = Array.isArray(body.days) ? body.days.filter(isYmd) : [];
    const count = Math.min(5, Math.max(1, Math.round(body.count ?? 1)));
    if (userIds.length === 0 || days.length === 0) {
      return NextResponse.json({ error: "Pick at least one creator and one day." }, { status: 400 });
    }
    const results: Record<string, { created: number; error?: string }> = {};
    let total = 0;
    for (const userId of userIds) {
      const demos = await listStudioClips(slug, { kind: "demo", userId });
      if (!isReadyCreator(config, demos)) {
        results[userId] = { created: 0, error: "not enough demos" };
        continue;
      }
      const ctx = await loadPlanContext({ slug, userId, config, isAdmin: true });
      let created = 0;
      let error: string | undefined;
      outer: for (const day of days) {
        for (let k = 0; k < count; k++) {
          const r = await createPlannedRender(ctx, {}, { scheduledFor: day, source: "admin" });
          if (!r.ok) {
            error = r.error;
            break outer;
          }
          created++;
        }
      }
      results[userId] = { created, error };
      total += created;
    }
    if (total > 0) kickStudioQueue();
    return NextResponse.json({ ok: true, created: total, results });
  }

  return NextResponse.json({ error: "unknown mode" }, { status: 400 });
}
