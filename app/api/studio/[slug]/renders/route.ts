import { NextResponse } from "next/server";
import { isYmd } from "@/lib/studio";
import { createPlannedRender, loadPlanContext, type PlanBody } from "@/lib/studio-plan";
import { kickStudioQueue } from "@/lib/studio-worker";
import { studioContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { scheduledFor?: "YYYY-MM-DD" } → generate one more video for that day
// (today when omitted). The hook, demo and background are chosen for the
// creator (lib/studio-plan.ts). Explicit picks in the body are honoured for
// admin tooling; the creator page never sends them.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await studioContext(slug);
  if (!ctx.ok) return ctx.res;
  let body: PlanBody & { scheduledFor?: string } = {};
  try {
    const text = await req.text();
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const scheduledFor = isYmd(body.scheduledFor) ? body.scheduledFor : null;
  const plan = await loadPlanContext({
    slug,
    userId: ctx.viewer.id,
    config: ctx.config,
    isAdmin: ctx.viewer.isAdmin,
  });
  const r = await createPlannedRender(plan, body, { scheduledFor, source: "creator" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  kickStudioQueue();
  return NextResponse.json({ ok: true, render: r.render });
}
