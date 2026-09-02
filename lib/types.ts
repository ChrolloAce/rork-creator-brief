export type Platform = "instagram" | "tiktok" | "x" | "youtube";

export type VideoExample = {
  platform: Platform;
  url: string;
  id: string;
  dbId?: string;
  title?: string;
  caption?: string;
  thumbnail: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  uploadDate?: string;
  creator: string;
  creatorUrl?: string;
};

export type Hook = {
  text: string;
  note?: string;
  hidden?: boolean;
};

// Rich list item used in editable format sections — gains an optional image.
// Static defaults (lib/formats.ts) remain plain strings; the union below lets
// either shape flow through without a code-wide migration.
export type ListItem = { text: string; image?: string; hidden?: boolean };
export type FormatListItem = string | ListItem;

// Sections of a format that can be hidden or reordered on the public
// page per brief.
export type FormatSectionKey =
  | "structure"
  | "script"
  | "examples"
  | "hooks"
  | "songs"
  | "assets"
  | "caption";

// Default rendering order on the public format page. Briefs that haven't
// customized fall back to this order.
export const DEFAULT_SECTION_ORDER: FormatSectionKey[] = [
  "script",
  "caption",
  "examples",
  "structure",
  "hooks",
  "songs",
  "assets",
];

// A sound/song creators should use on a video, pointed at by link (usually a
// TikTok music page, e.g. tiktok.com/music/som-original-7448647634538580741).
// Title/artist are optional labels; the link is the thing that matters.
export type FormatSong = {
  url: string;
  // The same sound on other platforms. A creator on Instagram cannot use a
  // TikTok sound link, so one entry carries every place the sound lives and
  // the public page shows a button per platform.
  altUrls?: string[];
  // Optional uploaded audio (/api/uploads/{id}) so a creator can download the
  // track and import it directly instead of relying on the in-app library.
  fileUrl?: string;
  fileMime?: string;
  title?: string;
  artist?: string;
  note?: string;
  hidden?: boolean;
};

// Downloadable per-format reference asset — videos showing overlay style,
// reference images, b-roll, etc. Stored out-of-band in image_blob; the
// `url` field points to /api/uploads/{id}.
export type FormatAsset = {
  url: string;
  mime: string;
  filename?: string;
  label?: string;
  // "overlay" assets render inline as a player on the public page so
  // creators can see the overlay style in context. Plain assets just
  // get a download button. "verse" assets render a Bible-verse style picker.
  kind?: "overlay" | "asset" | "verse";
  verseRef?: string;
  verseText?: string;
  verseVersion?: string;
};


// ---------------------------------------------------------------------------
// Script cues — an asset, an overlay or an on-screen line pinned to a moment
// in the script. This is the "shot list" layer: WHAT goes on screen, WHEN it
// comes in, HOW it is shown, and for HOW LONG.
//
// A cue anchors to a beat of the script by its timestamp ("00:03"), which is
// this app's writing convention, and falls back to a positional key ("#2") for
// untimed lines. Cues live beside the script text rather than inside it, so
// editing wording never corrupts the shot list and translation never touches
// it.
// ---------------------------------------------------------------------------

// How the thing is relayed on screen.
export type CueHow =
  | "broll"        // cut away to the clip, creator's voice keeps running
  | "overlay"      // sits on top of the talking-head shot
  | "fullscreen"   // takes over the frame
  | "pip"          // small inset corner window
  | "text"         // on-screen text / caption card
  | "sfx";         // sound effect, nothing visual

export const CUE_HOW_LABELS: Record<CueHow, string> = {
  broll: "B-roll (cut away)",
  overlay: "Overlay (on top)",
  fullscreen: "Full screen",
  pip: "Corner inset",
  text: "On-screen text",
  sfx: "Sound effect",
};

export const CUE_HOW_ICONS: Record<CueHow, string> = {
  broll: "\u2702",
  overlay: "\u25f1",
  fullscreen: "\u25a3",
  pip: "\u25f3",
  text: "T",
  sfx: "\u266a",
};

export type ScriptCue = {
  id: string;
  // Beat anchor: "00:03" for a timestamped line, "#2" for the 3rd untimed line.
  at: string;
  // Fallback anchor for untimed beats only: a normalized snapshot of the
  // line's text. Position shifts whenever a line is inserted or deleted above
  // it, so without this every cue on an untimed beat would come unpinned.
  atText?: string;
  how: CueHow;
  // Points at a FormatAsset.url on this format. Empty for a pure text/sfx cue.
  assetUrl?: string;
  // What the creator sees on the cue chip. Falls back to the asset's label.
  label?: string;
  // Seconds the thing stays on screen. Undefined = "until the beat ends".
  durationSec?: number;
  // Free-form direction ("mute it", "zoom in slowly", "hard cut back to face").
  note?: string;
};

// ---------------------------------------------------------------------------
// Caption — the copy that goes in the post itself, not in the video.
// ---------------------------------------------------------------------------

export type CaptionOption = {
  id: string;
  label?: string;
  text: string;
};

export type FormatCaption = {
  // The main caption creators copy and paste.
  text?: string;
  // Alternates so a creator picks one instead of every account posting the
  // identical string.
  options?: CaptionOption[];
  // Tags appended under the caption. Stored without the leading "#".
  hashtags?: string[];
  // Guidance about the caption (translated for ES; the caption itself is not).
  note?: string;
  // Optional call-to-action line pinned under the caption.
  cta?: string;
};

export type Format = {
  slug: string;
  title: string;
  thumbnail?: string;
  tagline: string;
  description: string;
  script?: string;
  bestFor: FormatListItem[];
  structure: FormatListItem[];
  tips: FormatListItem[];
  hookCategorySlugs: string[];
  examples: VideoExample[];
  hiddenSections?: FormatSectionKey[];
  sectionOrder?: FormatSectionKey[];
  assets?: FormatAsset[];
  songs?: FormatSong[];
  // Shot list pinned to the script's beats.
  scriptCues?: ScriptCue[];
  // Post copy (caption + hashtags), shown as its own section.
  caption?: FormatCaption;
};

export type HookCategory = {
  slug: string;
  title: string;
  summary: string;
  whyItWorks: string;
  hooks: Hook[];
};
