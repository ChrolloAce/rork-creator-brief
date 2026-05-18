import type { VideoExample } from "./types";

// Stat keys shared by the admin editor and the public preview.
export const SECTION_STAT_KEYS = [
  "videos",
  "views",
  "likes",
  "comments",
  "shares",
  "engagementRate",
  "commentPct",
  "likePct",
  "avgViews",
] as const;
export type SectionStatKey = (typeof SECTION_STAT_KEYS)[number];

export const SECTION_STAT_LABELS: Record<SectionStatKey, string> = {
  videos: "Videos",
  views: "Total Views",
  likes: "Total Likes",
  comments: "Total Comments",
  shares: "Total Shares",
  engagementRate: "Engagement %",
  commentPct: "Comment %",
  likePct: "Like %",
  avgViews: "Avg Views",
};

export const SECTION_STAT_DEFAULTS: SectionStatKey[] = [
  "videos",
  "views",
  "comments",
  "commentPct",
  "engagementRate",
];

export function compactNumber(n: number): string {
  if (!isFinite(n) || n === 0) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

export function computeSectionStat(
  key: SectionStatKey,
  vids: VideoExample[]
): string {
  if (vids.length === 0) return "—";
  const sum = (k: "views" | "likes" | "comments" | "shares") =>
    vids.reduce(
      (s, v) =>
        s + ((v as unknown as Record<string, number | undefined>)[k] ?? 0),
      0
    );
  const tv = sum("views");
  const tl = sum("likes");
  const tc = sum("comments");
  const ts = sum("shares");
  switch (key) {
    case "videos":
      return String(vids.length);
    case "views":
      return compactNumber(tv);
    case "likes":
      return compactNumber(tl);
    case "comments":
      return compactNumber(tc);
    case "shares":
      return compactNumber(ts);
    case "engagementRate":
      return tv > 0 ? (((tl + tc + ts) / tv) * 100).toFixed(2) + "%" : "—";
    case "commentPct":
      return tv > 0 ? ((tc / tv) * 100).toFixed(2) + "%" : "—";
    case "likePct":
      return tv > 0 ? ((tl / tv) * 100).toFixed(2) + "%" : "—";
    case "avgViews":
      return compactNumber(tv / vids.length);
  }
}

// Accept arbitrary strings from server and narrow to known keys.
export function sanitizeVisibleStats(raw: unknown): SectionStatKey[] {
  if (!Array.isArray(raw)) return SECTION_STAT_DEFAULTS;
  const allowed = new Set<string>(SECTION_STAT_KEYS);
  return raw.filter((k): k is SectionStatKey => typeof k === "string" && allowed.has(k));
}
