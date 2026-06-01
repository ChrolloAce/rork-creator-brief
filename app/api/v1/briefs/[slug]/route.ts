import { NextResponse } from "next/server";
import { getBrief, getCuration } from "@/lib/db";
import { getFormatsForRender } from "@/lib/format-videos";
import {
  absolutize,
  deepAbsolutize,
  publicizeFormat,
  requireAuth,
} from "../../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full dump of a single brief: meta, overview, onboarding, every format (with
// scripts + assets), and the complete curation payload (content calendar,
// per-format overrides, pins, public stats, etc.). Uploaded-file URLs anywhere
// in the tree are absolutized so callers get clickable links.
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
    const [formats, curation] = await Promise.all([
      getFormatsForRender(brief.slug),
      getCuration(brief.slug),
    ]);
    const fullCuration = deepAbsolutize(req, curation);
    return NextResponse.json({
      ok: true,
      brief: {
        slug: brief.slug,
        name: brief.name,
        logoUrl: brief.logoUrl ? absolutize(req, brief.logoUrl) : null,
        overview: deepAbsolutize(req, brief.overview),
        hookCategories: brief.hookCategories,
        onboarding: brief.onboarding,
        accessEnabled: brief.accessEnabled,
        requireLogin: brief.requireLogin,
        createdAt: brief.createdAt,
        updatedAt: brief.updatedAt,
      },
      formats: formats.map((f) => publicizeFormat(req, f)),
      // Convenience top-level calendar (also present inside `curation`).
      calendar: fullCuration.contentCalendar ?? null,
      curation: fullCuration,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
