import { NextResponse } from "next/server";
import { deleteStudioRender, getStudioRender } from "@/lib/db";
import { kickStudioQueue } from "@/lib/studio-worker";
import { studioContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ slug: string; id: string }> };

async function own(slug: string, id: string) {
  const ctx = await studioContext(slug);
  if (!ctx.ok) return { render: null as null, res: ctx.res };
  const render = await getStudioRender(id);
  if (!render || render.briefSlug !== slug) {
    return { render: null as null, res: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  if (render.userId !== ctx.viewer.id && !ctx.viewer.isAdmin) {
    return { render: null as null, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { render, res: null as null };
}

export async function GET(_req: Request, { params }: P) {
  const { slug, id } = await params;
  const r = await own(slug, id);
  if (!r.render) return r.res;
  if (r.render.status === "queued") kickStudioQueue();
  return NextResponse.json({ ok: true, render: r.render });
}

export async function DELETE(_req: Request, { params }: P) {
  const { slug, id } = await params;
  const r = await own(slug, id);
  if (!r.render) return r.res;
  await deleteStudioRender(id);
  return NextResponse.json({ ok: true });
}
