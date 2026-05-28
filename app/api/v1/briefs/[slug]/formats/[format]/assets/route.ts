import { NextResponse } from "next/server";
import { getBrief } from "@/lib/db";
import { getFormatsForRender } from "@/lib/format-videos";
import { publicizeAsset, requireAuth } from "../../../../../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; format: string }> }
) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { slug, format } = await params;
  try {
    const brief = await getBrief(slug);
    if (!brief) {
      return NextResponse.json({ error: "brief not found" }, { status: 404 });
    }
    const formats = await getFormatsForRender(brief.slug);
    const f = formats.find((x) => x.slug === format);
    if (!f) {
      return NextResponse.json({ error: "format not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      briefSlug: brief.slug,
      formatSlug: f.slug,
      assets: (f.assets ?? []).map((a) => publicizeAsset(req, a)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
