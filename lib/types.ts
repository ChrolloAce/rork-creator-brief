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

export type Format = {
  slug: string;
  title: string;
  thumbnail?: string;
  tagline: string;
  description: string;
  script?: string;
  bestFor: string[];
  structure: string[];
  tips: string[];
  hookCategorySlugs: string[];
  examples: VideoExample[];
};

export type HookCategory = {
  slug: string;
  title: string;
  summary: string;
  whyItWorks: string;
  hooks: Hook[];
};
