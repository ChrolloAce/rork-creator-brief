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
  | "assets";

// Default rendering order on the public format page. Briefs that haven't
// customized fall back to this order.
export const DEFAULT_SECTION_ORDER: FormatSectionKey[] = [
  "script",
  "examples",
  "structure",
  "hooks",
  "assets",
];

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
  // get a download button.
  kind?: "overlay" | "asset";
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
};

export type HookCategory = {
  slug: string;
  title: string;
  summary: string;
  whyItWorks: string;
  hooks: Hook[];
};
