import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public proxy for the Apple iTunes RSS — fetches an app's name + recent
// customer reviews so the admin can pick which ones to show in onboarding.
// GET /api/itunes-reviews?id=<appStoreId>&country=us
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("id") ?? "";
  const id = (raw.match(/\d{4,}/)?.[0]) ?? ""; // tolerate a pasted App Store URL
  const country = (searchParams.get("country") || "us").toLowerCase().slice(0, 2);
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing app id" }, { status: 400 });
  }

  let appName: string | undefined;
  try {
    const lr = await fetch(
      `https://itunes.apple.com/lookup?id=${id}&country=${country}`,
      { cache: "no-store" }
    );
    const lj = await lr.json();
    appName = lj?.results?.[0]?.trackName;
  } catch {
    /* name is optional */
  }

  try {
    const rr = await fetch(
      `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${id}/sortby=mostrecent/json`,
      { cache: "no-store" }
    );
    if (!rr.ok) {
      return NextResponse.json(
        { ok: false, error: `iTunes returned ${rr.status}` },
        { status: 502 }
      );
    }
    const rj = await rr.json();
    let entries = rj?.feed?.entry ?? [];
    if (!Array.isArray(entries)) entries = [entries];
    type Entry = {
      "im:rating"?: { label?: string };
      author?: { name?: { label?: string } };
      title?: { label?: string };
      content?: { label?: string };
    };
    const reviews = (entries as Entry[])
      .filter((e) => e && e["im:rating"])
      .map((e) => ({
        author: e.author?.name?.label ?? "Anonymous",
        rating: Number(e["im:rating"]?.label ?? 0) || 0,
        title: e.title?.label,
        body: e.content?.label ?? "",
      }));
    return NextResponse.json({ ok: true, appName, country, reviews });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
