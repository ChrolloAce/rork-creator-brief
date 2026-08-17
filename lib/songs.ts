// Sounds/songs attached to a format so creators know exactly which audio to
// use. A song is just a link (usually a TikTok music page) plus optional
// title/artist/note. Client-safe: shared by the public brief view and the
// admin editor.

export type SongPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "spotify"
  | "applemusic"
  | "other";

export const SONG_PLATFORM_LABELS: Record<SongPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  spotify: "Spotify",
  applemusic: "Apple Music",
  other: "Link",
};

export function detectSongPlatform(url: string): SongPlatform {
  const u = (url ?? "").toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("spotify.com")) return "spotify";
  if (u.includes("music.apple.com")) return "applemusic";
  return "other";
}

// TikTok music URLs carry the sound name in the slug:
//   https://www.tiktok.com/music/som-original-7448647634538580741
// → "Som Original". Everything else has no name in the URL, so we return "".
export function songTitleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\/music\/([^/?#]+)/);
    if (!m) return "";
    const slug = m[1].replace(/-\d{6,}$/, "");
    if (!slug) return "";
    return decodeURIComponent(slug)
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

export function normalizeSongUrl(url: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
