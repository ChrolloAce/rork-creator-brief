import { NextResponse } from "next/server";
import { listStudioForAdmin } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only (middleware gates /api/briefs/*): every creator's demos and
// renders on this brief, plus the shared background clips.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const data = await listStudioForAdmin(slug);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
