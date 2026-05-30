import { NextResponse } from "next/server";
import { joinBrief } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { slug: string };

// PUBLIC endpoint (not behind the admin cookie). A creator submits their name +
// the brief passcode to "sign in". Validates the code, records the creator, and
// returns a creator id the client can store. NOTE: the public brief pages don't
// call this yet — the gate is built but not live until access_enabled flips on.
export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  let body: { name?: string; code?: string; answers?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  try {
    const creator = await joinBrief({
      briefSlug: slug,
      name,
      code,
      answers: body.answers ?? {},
    });
    if (!creator) {
      return NextResponse.json(
        { ok: false, error: "wrong code" },
        { status: 401 }
      );
    }
    return NextResponse.json({ ok: true, creator });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
