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
};

// Rich list item used in editable format sections — gains an optional image.
// Static defaults (lib/formats.ts) remain plain strings; the union below lets
// either shape flow through without a code-wide migration.
export type ListItem = { text: string; image?: string };
export type FormatListItem = string | ListItem;

// Sections of a format that can be hidden on the public page per brief.
export type FormatSectionKey =
  | "bestFor"
  | "structure"
  | "tips"
  | "script"
  | "examples"
  | "hooks";

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
};

export type HookCategory = {
  slug: string;
  title: string;
  summary: string;
  whyItWorks: string;
  hooks: Hook[];
};
