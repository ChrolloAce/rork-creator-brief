import type { Format } from "./types";

export type NavSection = {
  label: string;
  items: {
    id: string;
    href: string;
    title: string;
    meta?: string;
    thumbnail?: string;
  }[];
};

export const overviewId = "overview";
export const formatId = (slug: string) => `format:${slug}`;

export function buildNavSections(
  formats: Format[],
  briefSlug: string
): NavSection[] {
  const base = `/b/${briefSlug}`;
  return [
    {
      label: "Start here",
      items: [
        {
          id: overviewId,
          href: base,
          title: "Overview",
          meta: "The brief",
        },
      ],
    },
    {
      label: "Formats",
      items: formats.map((f) => ({
        id: formatId(f.slug),
        href: `${base}/formats/${f.slug}`,
        title: f.title,
        meta: f.tagline,
        thumbnail: f.thumbnail,
      })),
    },
  ];
}
