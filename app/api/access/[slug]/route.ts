import { NextResponse } from "next/server";
import { upsertCreator, verifyBriefCode } from "@/lib/db";
import { accessCookieName, accessToken } from "@/lib/creator-access";

export const dynamic = "force-dynamic";

type Params = { slug: string };

// PUBLIC endpoint (not behind the admin cookie). Two modes:
//  - mode "onboarded": the creator finished onboarding / reached out — record
//    them as a lead (no code check, no access).
//  - mode "approve" (default when a code is sent): verify the code; on success
//    record them as approved and set the access cookie that unlocks the brief.
export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  let body: {
    name?: string;
    code?: string;
    answers?: Record<string, unknown>;
    clientId?: string;
    mode?: "onboarded" | "approve";
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const code = (body.code ?? "").trim();
  const clientId = body.clientId;
  const answers = body.answers ?? {};
  const mode = body.mode ?? (code ? "approve" : "onboarded");
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  try {
    if (mode === "onboarded") {
      const creator = await upsertCreator({
        briefSlug: slug,
        name,
        answers,
        status: "onboarded",
        clientId,
      });
      return NextResponse.json({ ok: true, creator });
    }

    // approve
    const valid = await verifyBriefCode(slug, code);
    if (!valid) {
      // Wrong code — still capture them as a finished-onboarding lead.
      await upsertCreator({
        briefSlug: slug,
        name,
        answers,
        status: "onboarded",
        clientId,
      });
      return NextResponse.json({ ok: false, error: "wrong code" }, { status: 401 });
    }
    const creator = await upsertCreator({
      briefSlug: slug,
      name,
      code,
      answers,
      status: "approved",
      clientId,
    });
    const res = NextResponse.json({ ok: true, creator });
    const token = await accessToken(slug, code);
    res.cookies.set(accessCookieName(slug), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
