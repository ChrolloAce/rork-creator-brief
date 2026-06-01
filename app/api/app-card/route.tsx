import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

// Satori's built-in font is a single regular weight, so fontWeight is ignored
// and bold text renders thin. Embed real Inter weights (v4 ships .woff, which
// Satori supports — v5 is woff2-only and won't work). Cached at module scope so
// it's fetched once per server, not per request.
type FontDef = { name: string; data: ArrayBuffer; weight: 400 | 700 | 900; style: "normal" };
let fontCache: FontDef[] | null = null;
async function loadFonts(): Promise<FontDef[]> {
  if (fontCache) return fontCache;
  const base = "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files";
  const weights: (400 | 700 | 900)[] = [400, 700, 900];
  const data = await Promise.all(
    weights.map((w) =>
      fetch(`${base}/inter-latin-${w}-normal.woff`).then((r) => r.arrayBuffer())
    )
  );
  fontCache = weights.map((w, i) => ({
    name: "Inter",
    data: data[i],
    weight: w,
    style: "normal" as const,
  }));
  return fontCache;
}

// Generates a live App Store-style card PNG (logo, title, rating, recent
// reviews) for a given App Store id. Always pulls fresh reviews, so the asset
// stays current instead of being a stale screenshot.
// GET /api/app-card?id=<appId>&country=us&n=3[&download=1]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") ?? "").match(/\d{4,}/)?.[0];
  const country = (searchParams.get("country") || "us").toLowerCase().slice(0, 2);
  // Default 0 = just the app card (logo, name, rating). n>0 adds review cards.
  const n = Math.min(4, Math.max(0, parseInt(searchParams.get("n") || "0", 10) || 0));
  const showReviews = n > 0;
  const download = searchParams.get("download") === "1";
  if (!id) return new Response("missing app id", { status: 400 });

  let name = "App";
  let subtitle = "";
  let icon = "";
  let rating = 0;
  let ratingCount = 0;
  try {
    const lr = await fetch(
      `https://itunes.apple.com/lookup?id=${id}&country=${country}`,
      { cache: "no-store" }
    );
    const a = (await lr.json())?.results?.[0];
    if (a) {
      name = a.trackName ?? name;
      subtitle = a.sellerName ?? a.primaryGenreName ?? "";
      icon = a.artworkUrl512 ?? a.artworkUrl100 ?? a.artworkUrl60 ?? "";
      rating = a.averageUserRating ?? 0;
      ratingCount = a.userRatingCount ?? 0;
    }
  } catch {
    /* ignore */
  }

  type Review = { author: string; rating: number; title: string; body: string };
  let reviews: Review[] = [];
  if (showReviews) try {
    const rr = await fetch(
      `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${id}/sortby=mostrecent/json`,
      { cache: "no-store" }
    );
    let entries = (await rr.json())?.feed?.entry ?? [];
    if (!Array.isArray(entries)) entries = [entries];
    reviews = entries
      .filter((e: { "im:rating"?: unknown }) => e && e["im:rating"])
      .slice(0, n)
      .map(
        (e: {
          author?: { name?: { label?: string } };
          "im:rating"?: { label?: string };
          title?: { label?: string };
          content?: { label?: string };
        }) => ({
          author: e.author?.name?.label ?? "Anonymous",
          rating: Number(e["im:rating"]?.label ?? 5) || 5,
          title: e.title?.label ?? "",
          body: e.content?.label ?? "",
        })
      );
  } catch {
    /* ignore */
  }

  const STAR = "#FFC400";
  // Round the rating count UP and abbreviate: 23,125 -> "24k", 1,150,000 -> "1.2M".
  const fmtCount = (n: number): string => {
    if (n >= 1_000_000) return `${(Math.ceil(n / 100_000) / 10).toString()}M`;
    if (n >= 1_000) return `${Math.ceil(n / 1_000)}k`;
    return n.toString();
  };
  const StarRow = ({ value, size }: { value: number; size: number }) => (
    <div style={{ display: "flex" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 3 }}>
          <path
            d="M12 2l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.02 6.1 20.17l1.13-6.57L2.45 8.94l6.6-.96z"
            fill={i < Math.round(value) ? STAR : "#3A3A3A"}
          />
        </svg>
      ))}
    </div>
  );

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: showReviews ? "flex-start" : "center",
          background: "#000000",
          padding: 72,
          fontFamily: "Inter",
        }}
      >
        {/* Header — big logo on the left, name + rating beside it */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={icon}
              width={340}
              height={340}
              style={{ borderRadius: 72, border: "5px solid #2A2A2A", flexShrink: 0 }}
            />
          ) : null}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 44,
              maxWidth: 640,
            }}
          >
            <div style={{ fontSize: 64, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.1 }}>
              {name}
            </div>
            {subtitle ? (
              <div style={{ fontSize: 34, color: "#A0A0A0", marginTop: 8 }}>
                {subtitle}
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
              <StarRow value={rating} size={58} />
              <div
                style={{
                  display: "flex",
                  fontSize: 52,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  marginLeft: 18,
                }}
              >
                {rating ? rating.toFixed(1) : ""}
              </div>
              {ratingCount ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 36,
                    color: "#A0A0A0",
                    marginLeft: 16,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {fmtCount(ratingCount)} ratings
                </div>
              ) : null}
            </div>
            {/* Availability pills — separate iOS and Android */}
            <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "2px solid #3A3A3A",
                  borderRadius: 999,
                  padding: "12px 26px",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  marginRight: 18,
                }}
              >
                {/* Apple logo */}
                <svg width={30} height={30} viewBox="0 0 24 24" style={{ marginRight: 12 }}>
                  <path
                    fill="#FFFFFF"
                    d="M16.37 12.78c.03 3.02 2.65 4.02 2.68 4.04-.02.07-.42 1.43-1.38 2.84-.83 1.22-1.69 2.43-3.05 2.46-1.33.02-1.76-.79-3.28-.79-1.52 0-2 .76-3.26.81-1.31.05-2.31-1.32-3.15-2.53C3.02 17.13 1.7 12.6 3.45 9.55c.87-1.52 2.42-2.48 4.11-2.5 1.29-.03 2.5.86 3.29.86.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.27-2.15 3.8M13.9 5.39c.69-.84 1.16-2 1.03-3.16-1 .04-2.2.66-2.92 1.49-.64.74-1.2 1.92-1.05 3.05 1.11.09 2.25-.56 2.94-1.38" />
                </svg>
                iOS
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "2px solid #3A3A3A",
                  borderRadius: 999,
                  padding: "12px 26px",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#FFFFFF",
                }}
              >
                {/* Android robot */}
                <svg width={30} height={30} viewBox="0 0 24 24" style={{ marginRight: 12 }}>
                  <path
                    fill="#3DDC84"
                    d="M17.6 9.48l1.84-3.18a.4.4 0 00-.69-.4l-1.86 3.22a11.3 11.3 0 00-9.78 0L5.25 5.9a.4.4 0 10-.69.4L6.4 9.48A11.1 11.1 0 001 18.5h22a11.1 11.1 0 00-5.4-9.02M7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5m10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5" />
                </svg>
                Android
              </div>
            </div>
          </div>
        </div>

        {/* Reviews (only when n > 0) */}
        {showReviews && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 44,
            flex: 1,
          }}
        >
          {reviews.map((rv, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                border: "4px solid #161616",
                borderRadius: 20,
                padding: 28,
                marginBottom: 22,
                background: "#FAFAF7",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <StarRow value={rv.rating} size={28} />
                <div style={{ display: "flex", fontSize: 24, color: "#6A6A6A", marginLeft: "auto" }}>
                  {rv.author}
                </div>
              </div>
              {rv.title ? (
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: "#0A0A0A",
                    marginTop: 10,
                  }}
                >
                  {rv.title}
                </div>
              ) : null}
              <div style={{ fontSize: 26, color: "#2A2A2A", marginTop: 8, lineHeight: 1.4 }}>
                {rv.body.length > 240 ? rv.body.slice(0, 240) + "…" : rv.body}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    ),
    {
      width: 1080,
      height: showReviews ? 1600 : 580,
      fonts: await loadFonts(),
      headers: download
        ? {
            "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-reviews.png"`,
          }
        : undefined,
    }
  );
  return res;
}
