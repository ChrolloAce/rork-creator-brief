import { NextResponse } from "next/server";
import { listBriefs } from "@/lib/db";
import { absolutize, requireAuth } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  try {
    const briefs = await listBriefs();
    return NextResponse.json({
      ok: true,
      briefs: briefs.map((b) => ({
        slug: b.slug,
        name: b.name,
        logoUrl: b.logoUrl ? absolutize(req, b.logoUrl) : null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
