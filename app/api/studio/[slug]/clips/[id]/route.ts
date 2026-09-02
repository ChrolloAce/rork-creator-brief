import { NextResponse } from "next/server";
import { deleteStudioClip, getStudioClip, updateStudioClip } from "@/lib/db";
import { studioContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ slug: string; id: string }> };

async function own(slug: string, id: string) {
  const ctx = await studioContext(slug);
  if (!ctx.ok) return { ctx, clip: null as null, res: ctx.res };
  const clip = await getStudioClip(id);
  if (!clip || clip.briefSlug !== slug) {
    return { ctx, clip: null as null, res: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  if (clip.userId !== ctx.viewer.id && !ctx.viewer.isAdmin) {
    return { ctx, clip: null as null, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ctx, clip, res: null as null };
}

export async function GET(_req: Request, { params }: P) {
  const { slug, id } = await params;
  const r = await own(slug, id);
  if (!r.clip) return r.res;
  return NextResponse.json({ ok: true, clip: r.clip });
}

export async function PATCH(req: Request, { params }: P) {
  const { slug, id } = await params;
  const r = await own(slug, id);
  if (!r.clip) return r.res;
  let body: { label?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const label = (body.label ?? "").trim().slice(0, 80) || null;
  await updateStudioClip(id, { label });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: P) {
  const { slug, id } = await params;
  const r = await own(slug, id);
  if (!r.clip) return r.res;
  await deleteStudioClip(id);
  return NextResponse.json({ ok: true });
}
