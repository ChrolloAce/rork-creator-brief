import { NextResponse } from "next/server";
import { listCreators, deleteCreator } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { slug: string };

// Admin-only (gated by middleware on /api/briefs/*). Returns the roster of
// creators who signed in to this brief.
export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  try {
    const creators = await listCreators(slug);
    return NextResponse.json({ ok: true, creators });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    await deleteCreator(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
