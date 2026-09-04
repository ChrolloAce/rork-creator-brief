import { NextResponse } from "next/server";
import { setStudioFlag } from "@/lib/db";
import { studioContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS = new Set(["accountsDone"]);

// POST { key, value } → remember a per-creator switch (e.g. accounts made).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await studioContext(slug);
  if (!ctx.ok) return ctx.res;
  let body: { key?: string; value?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.key || !KEYS.has(body.key)) {
    return NextResponse.json({ error: "unknown flag" }, { status: 400 });
  }
  await setStudioFlag(slug, ctx.viewer.id, body.key, body.value ?? true);
  return NextResponse.json({ ok: true });
}
