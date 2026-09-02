import { NextResponse } from "next/server";
import { getBrief } from "@/lib/db";
import { getFormatsForRender } from "@/lib/format-videos";
import { requireAuth } from "../../../../../_helpers";

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
    // Return plaintext if Accept: text/plain, JSON otherwise.
    const accept = req.headers.get("accept") ?? "";
    if (accept.includes("text/plain")) {
      return new Response(f.script ?? "", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.json({
      ok: true,
      briefSlug: brief.slug,
      formatSlug: f.slug,
      script: f.script ?? null,
      // Shot list pinned to the script's beats — each cue's `at` matches a
      // line's timestamp ("00:03") or its position ("#2").
      cues: f.scriptCues ?? [],
      caption: f.caption ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
