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
        color: "#0A0A0A",
        accent: "#F1610B",
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

  const body = (
    <>
      <div
        style={{
          width: "100%",
          fontSize: size,
          fontWeight: 800,
          color: s.color,
          lineHeight: 1.32,
          textAlign: "center",
        }}
      >
        {`“${text}”`}
      </div>
      {ref ? (
        <div
          style={{
            width: "100%",
            fontSize: 40,
            fontWeight: 800,
            color: s.accent,
            marginTop: 44,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {ref}
        </div>
      ) : null}
      {version ? (
        <div
          style={{
            width: "100%",
            fontSize: 24,
            color: s.color,
            opacity: 0.6,
            marginTop: 10,
            textAlign: "center",
          }}
        >
          {version}
        </div>
      ) : null}
    </>
  );

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          fontFamily: "sans-serif",
          ...s.bg,
        }}
      >
        {s.photo ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(255,255,255,0.88)",
              borderRadius: 28,
              padding: 64,
              width: "100%",
            }}
          >
            {body}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
            }}
          >
            {body}
          </div>
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
