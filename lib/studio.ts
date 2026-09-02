// Video Builder ("studio"): a per-brief system where creators upload their own
// demo clips, pick a hook + explanation, and the server stitches a satisfying
// background clip + on-screen text + their demo into one post-ready video with
// a caption. Built for the ElevenLabs campaign; off by default on every other
// brief, so those stay exactly as they were.
//
// Config lives in the curation JSONB (`studio`), clips + renders in their own
// tables (lib/db.ts studio_clip / studio_render). Bytes go through image_blob
// like every other upload so /api/uploads/{id} serves them with range support.

export type StudioHook = {
  id: string;
  // The first line on screen. Short, punchy, the reason to keep watching.
  hook: string;
  // The second card: what the thing is / why it matters. One or two sentences.
  explanation: string;
  // Optional caption override for this pair. Falls back to captionTemplate.
  caption?: string;
  hidden?: boolean;
};

export type StudioTextStyle = "pill" | "shadow";

export type StudioConfig = {
  enabled?: boolean;
  // Sidebar / page title. Default "Video Builder".
  title?: string;
  // Short paragraph shown at the top of the builder (plain text).
  intro?: string;
  hooks: StudioHook[];
  // Caption body. Supports {hook} and {explanation} placeholders.
  captionTemplate?: string;
  // Tags appended under the caption, stored without "#".
  hashtags?: string[];
  // Tags that must always be present (campaign requirement), also without "#".
  requiredHashtags?: string[];
  // Seconds the hook card stays up over the background clip.
  hookSec?: number;
  // Seconds the explanation card stays up. 0 = auto from word count.
  explanationSec?: number;
  // Guidance shown to creators ("upload 3 to 5 demos").
  minDemos?: number;
  maxDemos?: number;
  textStyle?: StudioTextStyle;
};

export const STUDIO_DEFAULTS = {
  title: "Video Builder",
  hookSec: 3,
  explanationSec: 0,
  minDemos: 3,
  maxDemos: 5,
  textStyle: "pill" as StudioTextStyle,
  // Hard cap on demos per creator per brief, regardless of guidance.
  demoCap: 12,
  // Longest demo we keep (seconds). Anything longer is trimmed at ingest.
  maxDemoSec: 90,
  // Longest background clip we keep.
  maxBrollSec: 30,
  // Raw upload ceiling (bytes). Phone 1080p60 for a minute is ~200MB.
  maxUploadBytes: 400 * 1024 * 1024,
};

export function studioTitle(c: StudioConfig | undefined | null): string {
  return c?.title?.trim() || STUDIO_DEFAULTS.title;
}

export function newHookId(): string {
  return `h_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Reading time for the explanation card: ~2.6 words/sec, clamped so a
// two-word line does not flash and a paragraph does not sit for ages.
export function autoExplanationSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(8, Math.max(2.5, Math.round((words / 2.6) * 2) / 2));
}

export function effectiveTimings(
  c: StudioConfig | undefined | null,
  explanation: string
): { hookSec: number; explanationSec: number } {
  const hookSec = clampSec(c?.hookSec, STUDIO_DEFAULTS.hookSec, 1.5, 8);
  const raw = c?.explanationSec ?? STUDIO_DEFAULTS.explanationSec;
  const explanationSec =
    raw && raw > 0 ? clampSec(raw, 4, 1.5, 12) : autoExplanationSec(explanation);
  return { hookSec, explanationSec };
}

function clampSec(v: number | undefined, dflt: number, lo: number, hi: number) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeTag(h: string): string {
  return h.trim().replace(/^#+/, "").replace(/\s+/g, "");
}

// The caption a creator copies: body (template or per-hook override) plus the
// hashtag line, with the required tags guaranteed present and first.
export function buildCaption(
  c: StudioConfig | undefined | null,
  hook: { hook: string; explanation: string; caption?: string }
): string {
  const template = hook.caption?.trim() || c?.captionTemplate?.trim() || "{explanation}";
  const body = template
    .replace(/\{hook\}/g, hook.hook.trim())
    .replace(/\{explanation\}/g, hook.explanation.trim())
    .trim();
  const required = (c?.requiredHashtags ?? []).map(normalizeTag).filter(Boolean);
  const rest = (c?.hashtags ?? []).map(normalizeTag).filter(Boolean);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of [...required, ...rest]) {
    const k = tag.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    tags.push(`#${tag}`);
  }
  return tags.length ? `${body}\n\n${tags.join(" ")}` : body;
}

// Public shape handed to the builder page. Hidden hooks are dropped here so
// the client never sees them.
export type StudioPublicConfig = {
  title: string;
  intro: string;
  hooks: StudioHook[];
  minDemos: number;
  maxDemos: number;
  demoCap: number;
  maxUploadBytes: number;
  maxDemoSec: number;
};

export function publicStudioConfig(c: StudioConfig): StudioPublicConfig {
  return {
    title: studioTitle(c),
    intro: c.intro?.trim() ?? "",
    hooks: (c.hooks ?? []).filter((h) => !h.hidden && h.hook?.trim()),
    minDemos: c.minDemos ?? STUDIO_DEFAULTS.minDemos,
    maxDemos: c.maxDemos ?? STUDIO_DEFAULTS.maxDemos,
    demoCap: STUDIO_DEFAULTS.demoCap,
    maxUploadBytes: STUDIO_DEFAULTS.maxUploadBytes,
    maxDemoSec: STUDIO_DEFAULTS.maxDemoSec,
  };
}

// Row shapes shared by the API and the client.
export type StudioClipKind = "demo" | "broll";
export type StudioJobStatus = "queued" | "processing" | "ready" | "error";

export type StudioClip = {
  id: string;
  briefSlug: string;
  kind: StudioClipKind;
  // creator_user.id for demos; "_admin" for clips uploaded from the admin.
  userId: string | null;
  label: string | null;
  filename: string | null;
  status: StudioJobStatus;
  error: string | null;
  // /api/uploads/{id} of the normalized mp4 and its poster jpg.
  url: string | null;
  posterUrl: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type StudioRender = {
  id: string;
  briefSlug: string;
  userId: string;
  hookId: string | null;
  hookText: string;
  explanationText: string;
  demoId: string | null;
  brollId: string | null;
  caption: string;
  status: StudioJobStatus;
  error: string | null;
  url: string | null;
  posterUrl: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  createdAt: string;
};

export function slugifyForFile(s: string, max = 40): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "video"
  );
}
