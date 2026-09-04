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

// What the video opens with. "broll": the admin's background clips with hook
// + explanation text cards (original flow). "library": the first N seconds of
// a reel from the brief's hook library (hook_video, see scripts/scrape-hooks.py),
// raw, no text, straight cut to the demo.
export type StudioOpening = "broll" | "library";

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
  opening?: StudioOpening;
  // Seconds of the library reel to keep when opening === "library".
  libraryHookSec?: number;
  // Curated "Reels to study" on the creator page. When set, ONLY these
  // hook_video ids show there (hidden rows allowed) and the "see all" link
  // is dropped. Empty/unset = the top of the brief's library as before.
  studyReelIds?: string[];
  // "How to record your demo": plain text, one bullet per line. Shown in
  // step 1 of the creator flow next to the example clips.
  recordGuide?: string;
  // Videos in advance. When autoFill is on, a creator who has the minimum
  // demos gets `perDay` videos queued for each of the next `daysAhead` days
  // (topped up whenever they open the page), so they show up to a calendar
  // that is already full. The admin can also schedule by hand.
  autoFill?: boolean;
  perDay?: number;
  daysAhead?: number;
  // What happens when the hook reel hands over to the demo. "cut" is a hard
  // cut. "pip" shrinks the reel into a corner over half a second and keeps it
  // playing there (muted) while the demo takes the frame.
  transition?: StudioTransition;
  pipCorner?: PipCorner;
  // Corner size as a fraction of the frame width (0.2 to 0.5).
  pipScale?: number;
  // "How to create your video": plain text, one bullet per line, shown with
  // the assets and the finished example (studio_clip kind "showcase").
  createGuide?: string;
  // Images and videos creators download to build or edit their videos.
  // Stored through /api/uploads like format assets.
  assets?: StudioAsset[];
  // The script creators read while recording, in the app's "00:03 line"
  // convention (lib/script-lines.ts). Shown with the recording guide.
  script?: string;
  // Step 1 pitch: the money. All free text so the admin can phrase it.
  payCpm?: string; // "$2"
  payMaxPerVideo?: string; // "$6,000"
  payCapViews?: string; // "1,000,000"
  payoutCadence?: string; // "Daily"
  // "Create your accounts" card on the calendar, one bullet per line, with
  // ==highlight== markup. Hidden once the creator taps Done.
  accountsGuide?: string;
  // Where creators must sign up to join the campaign. Shown as a button in
  // step 1 and on the accounts card.
  joinUrl?: string;
  joinLabel?: string;
};

export type StudioAsset = {
  id: string;
  url: string;
  mime: string;
  filename?: string;
  label?: string;
  // Script timestamp ("00:07") this asset is overlaid at. Pinned assets show
  // beside that line of the script; unpinned ones sit in the asset grid.
  at?: string;
};

export function newAssetId(): string {
  return `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export type StudioTransition = "cut" | "pip";
export type PipCorner = "bottom-left" | "top-left" | "bottom-right" | "top-right";

export function pipSettings(c: StudioConfig | undefined | null): {
  transition: StudioTransition;
  corner: PipCorner;
  scale: number;
  animSec: number;
  margin: number;
} {
  const corners: PipCorner[] = ["bottom-left", "top-left", "bottom-right", "top-right"];
  const scale = typeof c?.pipScale === "number" ? Math.min(0.5, Math.max(0.2, c.pipScale)) : 0.32;
  return {
    transition: c?.transition === "pip" ? "pip" : "cut",
    corner: corners.includes(c?.pipCorner as PipCorner) ? (c!.pipCorner as PipCorner) : "bottom-left",
    scale,
    animSec: 0.5,
    margin: 40,
  };
}

export const STUDIO_DEFAULTS = {
  title: "Video Builder",
  hookSec: 3,
  explanationSec: 0,
  // One demo unlocks the calendar; the admin raises this per brief if a
  // campaign wants more variety before anything is generated.
  minDemos: 1,
  maxDemos: 5,
  textStyle: "pill" as StudioTextStyle,
  opening: "broll" as StudioOpening,
  libraryHookSec: 10,
  autoFill: true,
  perDay: 1,
  daysAhead: 3,
  // Most renders one fill call may queue, so a misconfigured brief cannot
  // enqueue hundreds of encodes in one request.
  fillCap: 20,
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

export function effectiveLibraryHookSec(c: StudioConfig | undefined | null): number {
  return clampSec(c?.libraryHookSec, STUDIO_DEFAULTS.libraryHookSec, 3, 30);
}

export function studioOpening(c: StudioConfig | undefined | null): StudioOpening {
  return c?.opening === "library" ? "library" : "broll";
}

export function scheduleSettings(c: StudioConfig | undefined | null): {
  autoFill: boolean;
  perDay: number;
  daysAhead: number;
} {
  const perDay = Math.min(5, Math.max(0, Math.round(c?.perDay ?? STUDIO_DEFAULTS.perDay)));
  const daysAhead = Math.min(14, Math.max(1, Math.round(c?.daysAhead ?? STUDIO_DEFAULTS.daysAhead)));
  return { autoFill: c?.autoFill ?? STUDIO_DEFAULTS.autoFill, perDay, daysAhead };
}

// Calendar days as "YYYY-MM-DD" strings. The creator's browser decides what
// "today" is (their timezone), the server only shifts by whole days.
export function isYmd(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
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
  opening: StudioOpening;
  libraryHookSec: number;
  recordGuide: string[];
  createGuide: string[];
  assets: StudioAsset[];
  script: string;
  payCpm: string;
  payMaxPerVideo: string;
  payCapViews: string;
  payoutCadence: string;
  accountsGuide: string[];
  joinUrl: string;
  joinLabel: string;
  autoFill: boolean;
  perDay: number;
  daysAhead: number;
};

function guideLines(v: string | undefined): string[] {
  return (v ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

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
    opening: studioOpening(c),
    libraryHookSec: effectiveLibraryHookSec(c),
    recordGuide: guideLines(c.recordGuide),
    createGuide: guideLines(c.createGuide),
    assets: (c.assets ?? []).filter((a) => a && a.url),
    script: c.script?.trim() ?? "",
    payCpm: c.payCpm?.trim() ?? "",
    payMaxPerVideo: c.payMaxPerVideo?.trim() ?? "",
    payCapViews: c.payCapViews?.trim() ?? "",
    payoutCadence: c.payoutCadence?.trim() ?? "",
    accountsGuide: guideLines(c.accountsGuide),
    joinUrl: c.joinUrl?.trim() ?? "",
    joinLabel: c.joinLabel?.trim() ?? "",
    ...scheduleSettings(c),
  };
}

// Row shapes shared by the API and the client.
// demo: a creator's own clip. broll: admin background clip. example: admin
// "here is what a good demo looks like" clip, shown in step 1. showcase: a
// finished video, playable in the "how to create" section.
export type StudioClipKind = "demo" | "broll" | "example" | "showcase";
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
  // hook_video.id when the render opened with a library reel.
  hookVideoId: string | null;
  // The calendar day this video is for ("YYYY-MM-DD"). Legacy rows fall back
  // to the day they were created.
  scheduledFor: string;
  // Who asked for it: the creator tapping Generate, the auto-fill, or the
  // admin scheduling by hand.
  source: "creator" | "auto" | "admin";
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
