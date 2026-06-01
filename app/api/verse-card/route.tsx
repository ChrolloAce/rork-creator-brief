import { ImageResponse } from "next/og";
import { verseBackground } from "@/lib/verse-styles";

export const dynamic = "force-dynamic";

// Landscape card (3:2). Less vertical room than the old portrait card, so the
// type scale steps down a bit faster for long verses.
function fontFor(len: number): number {
  if (len <= 80) return 60;
  if (len <= 150) return 52;
  if (len <= 250) return 44;
  if (len <= 380) return 36;
  return 30;
}

// GET /api/verse-card?ref=John 3:16&text=...&version=WEB&style=mountains[&download=1]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = (searchParams.get("ref") ?? "").trim();
  const text = (searchParams.get("text") ?? "").trim();
  const version = (searchParams.get("version") ?? "").trim();
  const bgKey = (searchParams.get("style") ?? "").trim();
  const download = searchParams.get("download") === "1";
  if (!text) return new Response("missing text", { status: 400 });

  const bg = verseBackground(bgKey);
  const size = fontFor(text.length);

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: "sans-serif",
          backgroundImage: `url(${bg.url})`,
          backgroundSize: "1080px 720px",
        }}
      >
        {/* Full-bleed dark overlay so the white text reads over any photo. */}
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: 80,
            background: "rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              maxWidth: 880,
              fontSize: size,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.35,
              textAlign: "center",
              textShadow: "0 2px 16px rgba(0,0,0,0.6)",
            }}
          >
            {`“${text}”`}
          </div>
          {ref ? (
            <div
              style={{
                maxWidth: 880,
                fontSize: 30,
                fontWeight: 800,
                color: "#FFFFFF",
                marginTop: 36,
                textAlign: "center",
                letterSpacing: 3,
                textShadow: "0 2px 14px rgba(0,0,0,0.6)",
              }}
            >
              {ref.toUpperCase()}
            </div>
          ) : null}
          {version ? (
            <div
              style={{
                fontSize: 22,
                color: "#FFFFFF",
                opacity: 0.7,
                marginTop: 10,
                textAlign: "center",
              }}
            >
              {version}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 720,
      headers: download
        ? {
            "Content-Disposition": `attachment; filename="${(ref || "verse").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${bg.key}.png"`,
          }
        : undefined,
    }
  );
  return res;
}
