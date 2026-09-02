import "server-only";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StudioTextStyle } from "./studio";

// On-video text cards for the Video Builder, rendered with Satori (next/og)
// to a 1080x1920 PNG with alpha and overlaid by ffmpeg. Doing the type here
// instead of drawtext means real word wrapping, per-line pills and a font we
// control, on every host.

const W = 1080;
const H = 1920;

type FontSpec = { name: string; data: ArrayBuffer; weight: 700 | 900; style: "normal" };
let fontsPromise: Promise<FontSpec[]> | null = null;

function fonts(): Promise<FontSpec[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const dir = path.join(process.cwd(), "public", "fonts");
      const load = async (file: string, weight: 700 | 900): Promise<FontSpec> => {
        const buf = await readFile(path.join(dir, file));
        return {
          name: "Inter",
          data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          weight,
          style: "normal",
        };
      };
      return Promise.all([load("Inter-900.ttf", 900), load("Inter-700.ttf", 700)]);
    })().catch((e) => {
      fontsPromise = null;
      throw e;
    });
  }
  return fontsPromise;
}

// Greedy wrap by character budget. Satori would wrap on its own, but each
// line needs to be its own element to get its own pill.
export function wrapLines(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const word = w.length > maxChars ? w.slice(0, maxChars - 1) + "…" : w;
    if (!cur) cur = word;
    else if ((cur + " " + word).length <= maxChars) cur += " " + word;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function scale(text: string): { size: number; maxChars: number } {
  const n = text.trim().length;
  if (n <= 36) return { size: 76, maxChars: 20 };
  if (n <= 70) return { size: 66, maxChars: 23 };
  if (n <= 120) return { size: 58, maxChars: 26 };
  if (n <= 180) return { size: 50, maxChars: 30 };
  return { size: 44, maxChars: 34 };
}

export type CardTone = "hook" | "explanation";

// Hook: white type on black pills. Explanation: black type on white pills.
// The swap is deliberate: the eye registers "new card" even before reading.
export async function renderTextCard(
  text: string,
  opts: { tone: CardTone; style?: StudioTextStyle }
): Promise<Buffer> {
  const style = opts.style ?? "pill";
  const { size, maxChars } = scale(text);
  const lines = wrapLines(text, maxChars);
  const dark = opts.tone === "hook";
  const fg = style === "pill" ? (dark ? "#FFFFFF" : "#0A0A0A") : "#FFFFFF";
  const bg = dark ? "rgba(10,10,10,0.82)" : "rgba(255,255,255,0.94)";
  const res = new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // Sit a little above centre: TikTok's caption and buttons live in
          // the bottom third, so text there gets covered.
          paddingBottom: 260,
          paddingLeft: 60,
          paddingRight: 60,
          fontFamily: "Inter",
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontSize: size,
              fontWeight: 900,
              lineHeight: 1.12,
              color: fg,
              textAlign: "center",
              whiteSpace: "pre",
              ...(style === "pill"
                ? {
                    background: bg,
                    padding: `${Math.round(size * 0.16)}px ${Math.round(size * 0.36)}px`,
                    borderRadius: Math.round(size * 0.28),
                    marginTop: i === 0 ? 0 : -Math.round(size * 0.1),
                  }
                : {
                    textShadow:
                      "0 3px 6px rgba(0,0,0,0.85), 0 0 22px rgba(0,0,0,0.6)",
                    padding: `${Math.round(size * 0.06)}px 0`,
                  }),
            }}
          >
            {line || " "}
          </div>
        ))}
      </div>
    ),
    { width: W, height: H, fonts: await fonts() }
  );
  return Buffer.from(await res.arrayBuffer());
}
