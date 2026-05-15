import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cloneFormatInBrief, getBrief } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug: briefSlug } = await params;

  const brief = await getBrief(briefSlug);
  if (!brief) {
    return NextResponse.json({ error: "brief not found" }, { status: 404 });
  }

  let body: { formatSlug?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const formatSlug = (body.formatSlug ?? "").trim();
  if (!formatSlug) {
    return NextResponse.json({ error: "formatSlug required" }, { status: 400 });
  }

  try {
    const { newSlug } = await cloneFormatInBrief({
      briefSlug,
      sourceSlug: formatSlug,
    });
    revalidatePath(`/admin/b/${briefSlug}`);
    revalidatePath(`/b/${briefSlug}`);
    return NextResponse.json({ ok: true, newSlug });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
