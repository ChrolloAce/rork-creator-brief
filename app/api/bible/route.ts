import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fetch a Bible verse by reference via the free bible-api.com (no key).
// GET /api/bible?ref=John%203:16[&translation=web]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = (searchParams.get("ref") ?? "").trim();
  const translation = (searchParams.get("translation") || "web").trim();
  if (!ref) {
    return NextResponse.json({ ok: false, error: "missing reference" }, { status: 400 });
  }
  try {
    const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${encodeURIComponent(translation)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "Couldn't find that reference." },
        { status: 404 }
      );
    }
    const j = await r.json();
    const text = (j?.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "No text found for that reference." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      reference: j.reference ?? ref,
      text,
      translation: (j.translation_id ?? translation).toUpperCase(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
