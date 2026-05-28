import { NextResponse } from "next/server";
import { getBrief } from "@/lib/db";
import { getFormatsForRender } from "@/lib/format-videos";
import { absolutize, publicizeFormat, requireAuth } from "../../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const { slug } = await params;
  try {
    const brief = await getBrief(slug);
    if (!brief) {
      return NextResponse.json({ error: "brief not found" }, { status: 404 });
    }
    const formats = await getFormatsForRender(brief.slug);
    return NextResponse.json({
      ok: true,
      brief: {
        slug: brief.slug,
        name: brief.name,
        logoUrl: brief.logoUrl ? absolutize(req, brief.logoUrl) : null,
        overview: brief.overview,
        hookCategories: brief.hookCategories,
        createdAt: brief.createdAt,
        updatedAt: brief.updatedAt,
      },
      formats: formats.map((f) => publicizeFormat(req, f)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
