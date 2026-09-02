import { NextResponse } from "next/server";
import {
  createStudioRender,
  getStudioClip,
  listStudioClips,
  listStudioRenders,
} from "@/lib/db";
import { buildCaption } from "@/lib/studio";
import { kickStudioQueue } from "@/lib/studio-worker";
import { studioContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pick the item this creator has used least, at random among ties, so every
// tap of Generate gives a different mix and the whole hook list gets worked
// through before anything repeats.
function leastUsed<T extends { id: string }>(items: T[], used: Map<string, number>): T {
  let best: T[] = [];
  let bestN = Infinity;
  for (const it of items) {
    const n = used.get(it.id) ?? 0;
    if (n < bestN) {
      bestN = n;
      best = [it];
    } else if (n === bestN) best.push(it);
  }
  return best[Math.floor(Math.random() * best.length)];
}

// POST {} → generate: hook, demo and background are chosen for the creator.
// Explicit hookId / demoId / brollId / hook / explanation are honoured when
// sent (admin tooling), but the creator page sends nothing.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await studioContext(slug);
  if (!ctx.ok) return ctx.res;
  let body: { hookId?: string; hook?: string; explanation?: string; demoId?: string; brollId?: string } = {};
  try {
    const text = await req.text();
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const [mine, myDemos, pool] = await Promise.all([
    listStudioRenders(slug, ctx.viewer.id),
    listStudioClips(slug, { kind: "demo", userId: ctx.viewer.id }),
    listStudioClips(slug, { kind: "broll" }),
  ]);
  const readyBroll = pool.filter((b) => b.status === "ready");
  if (readyBroll.length === 0) {
    return NextResponse.json(
      { error: "No background clips yet. The team needs to add at least one." },
      { status: 400 }
    );
  }

  // Hook + explanation
  const liveHooks = ctx.config.hooks.filter(
    (h) => !h.hidden && h.hook?.trim() && h.explanation?.trim()
  );
  let pair = body.hookId ? ctx.config.hooks.find((h) => h.id === body.hookId) : undefined;
  if (!pair && !(body.hook?.trim() && body.explanation?.trim())) {
    if (liveHooks.length === 0) {
      return NextResponse.json({ error: "No hooks written yet." }, { status: 400 });
    }
    const used = new Map<string, number>();
    for (const r of mine) if (r.hookId) used.set(r.hookId, (used.get(r.hookId) ?? 0) + 1);
    pair = leastUsed(liveHooks, used);
  }
  const hook = (body.hook?.trim() || pair?.hook || "").slice(0, 240);
  const explanation = (body.explanation?.trim() || pair?.explanation || "").slice(0, 600);
  if (!hook || !explanation) {
    return NextResponse.json({ error: "No hooks written yet." }, { status: 400 });
  }

  // Demo
  let demo = body.demoId ? await getStudioClip(body.demoId) : null;
  if (body.demoId) {
    if (!demo || demo.briefSlug !== slug || demo.kind !== "demo") {
      return NextResponse.json({ error: "That demo does not exist." }, { status: 404 });
    }
    if (demo.userId !== ctx.viewer.id && !ctx.viewer.isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (demo.status !== "ready") {
      return NextResponse.json({ error: "That demo is still processing." }, { status: 400 });
    }
  } else {
    const ready = myDemos.filter((d) => d.status === "ready");
    if (ready.length === 0) {
      return NextResponse.json({ error: "Upload a demo first." }, { status: 400 });
    }
    const used = new Map<string, number>();
    for (const r of mine) if (r.demoId) used.set(r.demoId, (used.get(r.demoId) ?? 0) + 1);
    demo = leastUsed(ready, used);
  }

  // Background
  let brollId = body.brollId ?? null;
  if (brollId) {
    if (!readyBroll.some((b) => b.id === brollId)) {
      return NextResponse.json({ error: "That background clip is not available." }, { status: 404 });
    }
  } else {
    const used = new Map<string, number>();
    for (const r of mine) if (r.brollId) used.set(r.brollId, (used.get(r.brollId) ?? 0) + 1);
    brollId = leastUsed(readyBroll, used).id;
  }

  const caption = buildCaption(ctx.config, { hook, explanation, caption: pair?.caption });
  const render = await createStudioRender({
    briefSlug: slug,
    userId: ctx.viewer.id,
    hookId: pair?.id ?? null,
    hookText: hook,
    explanationText: explanation,
    demoId: demo!.id,
    brollId,
    caption,
  });
  kickStudioQueue();
  return NextResponse.json({ ok: true, render });
}
