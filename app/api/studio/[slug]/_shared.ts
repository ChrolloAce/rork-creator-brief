import { NextResponse } from "next/server";
import { getBrief, getCuration } from "@/lib/db";
import { studioConfigFor, studioViewer, type StudioViewer } from "@/lib/studio-auth";
import type { StudioConfig } from "@/lib/studio";

// Every builder route needs the same three things: a real brief, the builder
// switched on for it, and someone signed in. One helper, one set of errors.
export async function studioContext(slug: string): Promise<
  | { ok: true; viewer: StudioViewer; config: StudioConfig }
  | { ok: false; res: NextResponse }
> {
  const brief = await getBrief(slug);
  if (!brief) return { ok: false, res: NextResponse.json({ error: "not found" }, { status: 404 }) };
  const viewer = await studioViewer();
  if (!viewer) return { ok: false, res: NextResponse.json({ error: "sign in" }, { status: 401 }) };
  let config = await studioConfigFor(slug);
  // Admins can upload background clips and test-build before flipping the
  // builder on for creators.
  if (!config && viewer.isAdmin) {
    const raw = (await getCuration(slug)).studio;
    config = { ...(raw ?? { hooks: [] }), hooks: Array.isArray(raw?.hooks) ? raw.hooks : [] };
  }
  if (!config) return { ok: false, res: NextResponse.json({ error: "builder is off" }, { status: 404 }) };
  return { ok: true, viewer, config };
}
