import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public proxy for the iTunes Search API — find an app by name so the admin
// doesn't need to dig up its App Store ID.
// GET /api/itunes-search?term=prayer%20lock&country=us
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const term = (searchParams.get("term") ?? "").trim();
  const country = (searchParams.get("country") || "us").toLowerCase().slice(0, 2);
  if (!term) {
    return NextResponse.json({ ok: false, error: "missing term" }, { status: 400 });
  }
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&entity=software&country=${country}&limit=8`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `iTunes returned ${r.status}` },
        { status: 502 }
      );
    }
    const j = await r.json();
    type Result = {
      trackId?: number;
      trackName?: string;
      artistName?: string;
      artworkUrl100?: string;
      artworkUrl60?: string;
      averageUserRating?: number;
      userRatingCount?: number;
    };
    const apps = (j?.results ?? [])
      .filter((a: Result) => a.trackId)
      .map((a: Result) => ({
        id: String(a.trackId),
        name: a.trackName ?? "",
        developer: a.artistName ?? "",
        icon: a.artworkUrl100 ?? a.artworkUrl60 ?? "",
        rating: a.averageUserRating ?? 0,
        ratingCount: a.userRatingCount ?? 0,
      }));
    return NextResponse.json({ ok: true, apps });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
