import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

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

  const ORANGE = "#F1610B";
  const StarRow = ({ value, size }: { value: number; size: number }) => (
    <div style={{ display: "flex" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 3 }}>
          <path
            d="M12 2l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.02 6.1 20.17l1.13-6.57L2.45 8.94l6.6-.96z"
            fill={i < Math.round(value) ? ORANGE : "#E2E2E2"}
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
          justifyContent: showReviews ? "flex-start" : "center",
          background: "#FFFFFF",
          padding: 56,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={icon}
              width={150}
              height={150}
              style={{ borderRadius: 34, border: "4px solid #161616" }}
            />
          ) : null}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 28,
              flex: 1,
            }}
          >
            <div style={{ fontSize: 52, fontWeight: 800, color: "#0A0A0A" }}>
              {name}
            </div>
            {subtitle ? (
              <div style={{ fontSize: 28, color: "#6A6A6A", marginTop: 4 }}>
                {subtitle}
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
              <StarRow value={rating} size={40} />
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 800,
                  color: "#0A0A0A",
                  marginLeft: 16,
                }}
              >
                {rating ? rating.toFixed(1) : ""}
              </div>
              {ratingCount ? (
                <div style={{ display: "flex", fontSize: 26, color: "#6A6A6A", marginLeft: 14 }}>
                  {ratingCount.toLocaleString()} ratings
                </div>
              ) : null}
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
                    fontWeight: 800,
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
      height: showReviews ? 1350 : 440,
      headers: download
        ? {
            "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-reviews.png"`,
          }
        : undefined,
    }
  );
  return res;
}
