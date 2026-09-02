import "server-only";
import {
  createStudioRender,
  getStudioClip,
  listStudioClips,
  listStudioRenders,
} from "./db";
import { getHookVideos, hookVideoLine, type HookVideo } from "./hook-videos";
import {
  STUDIO_DEFAULTS,
  addDaysYmd,
  buildCaption,
  scheduleSettings,
  studioOpening,
  type StudioConfig,
  type StudioRender,
} from "./studio";
import { kickStudioQueue } from "./studio-worker";

// Deciding what goes into a video. Used by the creator's Generate button, by
// the auto-fill that keeps their calendar stocked, and by the admin scheduling
// by hand, so all three pick the same way: whatever this creator has used
// least, at random among ties.

export type PlanBody = {
  hookId?: string;
  hook?: string;
  explanation?: string;
  demoId?: string;
  brollId?: string;
  hookVideoId?: string;
};

export type PlanResult =
  | { ok: true; create: Parameters<typeof createStudioRender>[0] }
  | { ok: false; error: string; status: number };

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

function usage(renders: StudioRender[], key: keyof StudioRender): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of renders) {
    const v = r[key];
    if (typeof v === "string" && v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

// Snapshot of everything a plan needs, fetched once so a fill that creates
// several videos does not hit the database per video.
export type PlanContext = {
  slug: string;
  userId: string;
  config: StudioConfig;
  isAdmin: boolean;
  mine: StudioRender[];
  myDemos: Awaited<ReturnType<typeof listStudioClips>>;
  readyBroll: Awaited<ReturnType<typeof listStudioClips>>;
  reels: HookVideo[];
};

export async function loadPlanContext(opts: {
  slug: string;
  userId: string;
  config: StudioConfig;
  isAdmin: boolean;
}): Promise<PlanContext> {
  const library = studioOpening(opts.config) === "library";
  const [mine, myDemos, pool, reels] = await Promise.all([
    listStudioRenders(opts.slug, opts.userId),
    listStudioClips(opts.slug, { kind: "demo", userId: opts.userId }),
    library ? Promise.resolve([]) : listStudioClips(opts.slug, { kind: "broll" }),
    library ? getHookVideos(opts.slug) : Promise.resolve([]),
  ]);
  return {
    ...opts,
    mine,
    myDemos,
    readyBroll: pool.filter((b) => b.status === "ready"),
    reels,
  };
}

export async function planRender(
  ctx: PlanContext,
  body: PlanBody,
  opts: { scheduledFor: string | null; source: "creator" | "auto" | "admin" }
): Promise<PlanResult> {
  const { slug, userId, config, isAdmin, mine } = ctx;
  const library = studioOpening(config) === "library";
  if (!library && ctx.readyBroll.length === 0) {
    return { ok: false, status: 400, error: "No background clips yet. The team needs to add at least one." };
  }

  // Library opening: the hook IS a reel; caption line comes from its caption.
  let reel: HookVideo | null = null;
  if (library) {
    if (ctx.reels.length === 0) {
      return { ok: false, status: 400, error: "No reels in the hook library yet." };
    }
    if (body.hookVideoId) {
      reel = ctx.reels.find((r) => r.id === body.hookVideoId) ?? null;
      if (!reel) return { ok: false, status: 404, error: "That reel is not in the library." };
    } else {
      reel = leastUsed(ctx.reels, usage(mine, "hookVideoId"));
    }
  }

  // Hook + explanation (broll opening)
  const liveHooks = config.hooks.filter((h) => !h.hidden && h.hook?.trim() && h.explanation?.trim());
  let pair = body.hookId ? config.hooks.find((h) => h.id === body.hookId) : undefined;
  if (!library && !pair && !(body.hook?.trim() && body.explanation?.trim())) {
    if (liveHooks.length === 0) return { ok: false, status: 400, error: "No hooks written yet." };
    pair = leastUsed(liveHooks, usage(mine, "hookId"));
  }
  const hook = (reel ? hookVideoLine(reel) : body.hook?.trim() || pair?.hook || "").slice(0, 240);
  const explanation = reel ? "" : (body.explanation?.trim() || pair?.explanation || "").slice(0, 600);
  if (!library && (!hook || !explanation)) {
    return { ok: false, status: 400, error: "No hooks written yet." };
  }

  // Demo
  let demo = body.demoId ? await getStudioClip(body.demoId) : null;
  if (body.demoId) {
    if (!demo || demo.briefSlug !== slug || demo.kind !== "demo") {
      return { ok: false, status: 404, error: "That demo does not exist." };
    }
    if (demo.userId !== userId && !isAdmin) return { ok: false, status: 403, error: "forbidden" };
    if (demo.status !== "ready") return { ok: false, status: 400, error: "That demo is still processing." };
  } else {
    const ready = ctx.myDemos.filter((d) => d.status === "ready");
    if (ready.length === 0) return { ok: false, status: 400, error: "Upload a demo first." };
    demo = leastUsed(ready, usage(mine, "demoId"));
  }

  // Background (broll opening only)
  let brollId = body.brollId ?? null;
  if (library) {
    brollId = null;
  } else if (brollId) {
    if (!ctx.readyBroll.some((b) => b.id === brollId)) {
      return { ok: false, status: 404, error: "That background clip is not available." };
    }
  } else {
    brollId = leastUsed(ctx.readyBroll, usage(mine, "brollId")).id;
  }

  const caption = buildCaption(config, { hook, explanation, caption: pair?.caption });
  return {
    ok: true,
    create: {
      briefSlug: slug,
      userId,
      hookId: pair?.id ?? null,
      hookText: hook,
      explanationText: explanation,
      demoId: demo!.id,
      brollId,
      hookVideoId: reel?.id ?? null,
      caption,
      scheduledFor: opts.scheduledFor,
      source: opts.source,
    },
  };
}

// Plan + create one video and remember it in the context, so the next pick in
// the same fill sees it as "used" and rotates away from it.
export async function createPlannedRender(
  ctx: PlanContext,
  body: PlanBody,
  opts: { scheduledFor: string | null; source: "creator" | "auto" | "admin" }
): Promise<{ ok: true; render: StudioRender } | { ok: false; error: string; status: number }> {
  const plan = await planRender(ctx, body, opts);
  if (!plan.ok) return plan;
  const render = await createStudioRender(plan.create);
  ctx.mine = [render, ...ctx.mine];
  return { ok: true, render };
}

export function isReadyCreator(
  config: StudioConfig,
  demos: { status: string }[]
): boolean {
  const min = Math.max(1, config.minDemos ?? STUDIO_DEFAULTS.minDemos);
  return demos.filter((d) => d.status === "ready").length >= min;
}

// Top up the coming days so a creator opens a calendar that is already full.
// Idempotent: counts what exists per day (errors excluded) and only queues the
// difference, capped so one call can never enqueue a mountain of encodes.
export async function ensureSchedule(opts: {
  slug: string;
  userId: string;
  config: StudioConfig;
  isAdmin?: boolean;
  today: string;
  // Override the config (admin "fill now" ignores the autoFill switch).
  force?: boolean;
  perDay?: number;
  daysAhead?: number;
}): Promise<{ created: number; reason?: string }> {
  const settings = scheduleSettings(opts.config);
  if (!settings.autoFill && !opts.force) return { created: 0, reason: "auto-fill off" };
  const perDay = opts.perDay ?? settings.perDay;
  const daysAhead = opts.daysAhead ?? settings.daysAhead;
  if (perDay <= 0) return { created: 0, reason: "perDay is 0" };
  const ctx = await loadPlanContext({
    slug: opts.slug,
    userId: opts.userId,
    config: opts.config,
    isAdmin: !!opts.isAdmin,
  });
  if (!isReadyCreator(opts.config, ctx.myDemos)) return { created: 0, reason: "not enough demos" };

  const counts = new Map<string, number>();
  for (const r of ctx.mine) {
    if (r.status === "error") continue;
    counts.set(r.scheduledFor, (counts.get(r.scheduledFor) ?? 0) + 1);
  }
  let created = 0;
  let firstError: string | undefined;
  outer: for (let i = 0; i < daysAhead; i++) {
    const day = addDaysYmd(opts.today, i);
    const missing = perDay - (counts.get(day) ?? 0);
    for (let k = 0; k < missing; k++) {
      if (created >= STUDIO_DEFAULTS.fillCap) break outer;
      const r = await createPlannedRender(ctx, {}, { scheduledFor: day, source: "auto" });
      if (!r.ok) {
        firstError = r.error;
        break outer;
      }
      created++;
    }
  }
  if (created > 0) kickStudioQueue();
  return { created, reason: firstError };
}
