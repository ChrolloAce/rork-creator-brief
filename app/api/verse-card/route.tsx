import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

const PHOTO =
  "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=1080&q=70";

type StyleDef = {
  bg: React.CSSProperties;
  color: string;
  accent: string;
  photo?: boolean;
};

function getStyle(key: string): StyleDef {
  switch (key) {
    case "pink":
      return {
        bg: { backgroundImage: "linear-gradient(135deg,#FFE3EC,#FFB3CE)" },
        color: "#7A0B3A",
        accent: "#D6336C",
      };
    case "girly":
      return {
        bg: { backgroundImage: "linear-gradient(135deg,#FDE7F3,#E9D5FF)" },
        color: "#6B21A8",
        accent: "#DB2777",
      };
    case "boy":
      return {
        bg: { backgroundImage: "linear-gradient(135deg,#0F172A,#1E293B)" },
        color: "#FFFFFF",
        accent: "#38BDF8",
      };
    case "gold":
      return {
        bg: { backgroundImage: "linear-gradient(135deg,#FFF7E6,#F6DB93)" },
        color: "#7A5B00",
        accent: "#B7791F",
      };
    case "dark":
      return { bg: { backgroundColor: "#0A0A0A" }, color: "#FFFFFF", accent: "#F1610B" };
    case "photo":
      return {
        bg: {
          backgroundImage: `url(${PHOTO})`,
          backgroundSize: "1080px 1350px",
        },
        color: "#FFFFFF",
        accent: "#FFFFFF",
        photo: true,
      };
    default: // light
      return { bg: { backgroundColor: "#FFFFFF" }, color: "#0A0A0A", accent: "#F1610B" };
  }
}

function fontFor(len: number): number {
  if (len <= 90) return 72;
  if (len <= 170) return 60;
  if (len <= 280) return 50;
  if (len <= 420) return 42;
  return 36;
}

// GET /api/verse-card?ref=John 3:16&text=...&version=WEB&style=pink[&download=1]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = (searchParams.get("ref") ?? "").trim();
  const text = (searchParams.get("text") ?? "").trim();
  const version = (searchParams.get("version") ?? "").trim();
  const styleKey = (searchParams.get("style") ?? "light").trim();
  const download = searchParams.get("download") === "1";
  if (!text) return new Response("missing text", { status: 400 });

  const s = getStyle(styleKey);
  const size = fontFor(text.length);

  // The card content. Children fill the width (default flex stretch) so the
  // verse wraps; textAlign centers each line. Quote glyph stays a straight " to
  // avoid missing-glyph boxes in the default font.
  const card = (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          fontSize: size,
          fontWeight: 700,
          color: s.color,
          lineHeight: 1.35,
          textAlign: "center",
          textShadow: s.photo ? "0 2px 16px rgba(0,0,0,0.6)" : "none",
        }}
      >
        {`“${text}”`}
      </div>
      {ref ? (
        <div
          style={{
            maxWidth: 900,
            fontSize: 38,
            fontWeight: 800,
            color: s.accent,
            marginTop: 48,
            textAlign: "center",
            letterSpacing: 3,
            textShadow: s.photo ? "0 2px 14px rgba(0,0,0,0.6)" : "none",
          }}
        >
          {ref.toUpperCase()}
        </div>
      ) : null}
      {version ? (
        <div
          style={{
            fontSize: 24,
            color: s.color,
            opacity: 0.55,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          {version}
        </div>
      ) : null}
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
          justifyContent: "center",
          padding: s.photo ? 0 : 90,
          fontFamily: "sans-serif",
          ...s.bg,
        }}
      >
        {s.photo ? (
          // Full-bleed dark overlay so the white text reads over the photo.
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: 96,
              background: "rgba(0,0,0,0.45)",
            }}
          >
            {card}
          </div>
        ) : (
          card
        )}
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: download
        ? {
            "Content-Disposition": `attachment; filename="${(ref || "verse").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${styleKey}.png"`,
          }
        : undefined,
    }
  );
  return res;
}
