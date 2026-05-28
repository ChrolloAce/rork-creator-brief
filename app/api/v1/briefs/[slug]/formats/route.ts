import { NextResponse } from "next/server";
import { getBrief } from "@/lib/db";
import { getFormatsForRender } from "@/lib/format-videos";
import { requireAuth } from "../../../_helpers";

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
      briefSlug: brief.slug,
      formats: formats.map((f) => ({
        slug: f.slug,
        title: f.title,
        tagline: f.tagline,
        thumbnail: f.thumbnail ?? null,
        exampleCount: f.examples.length,
        assetCount: f.assets?.length ?? 0,
        hasScript: !!f.script,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
