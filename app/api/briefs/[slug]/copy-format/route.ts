import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { copyFormatSection, getBrief } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug: srcSlug } = await params;

  let body: { targetSlug?: string; formatSlug?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const dstSlug = (body.targetSlug ?? "").trim();
  const formatSlug = (body.formatSlug ?? "").trim();
  if (!dstSlug) {
    return NextResponse.json({ error: "targetSlug required" }, { status: 400 });
  }
  if (!formatSlug) {
    return NextResponse.json({ error: "formatSlug required" }, { status: 400 });
  }
  if (dstSlug === srcSlug) {
    return NextResponse.json(
      { error: "source and target are the same" },
      { status: 400 }
    );
  }

  const dst = await getBrief(dstSlug);
  if (!dst) {
    return NextResponse.json(
      { error: "target brief not found" },
      { status: 404 }
    );
  }

  try {
    await copyFormatSection({ srcSlug, dstSlug, formatSlug });
    revalidatePath(`/admin/b/${dstSlug}`);
    revalidatePath(`/b/${dstSlug}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
