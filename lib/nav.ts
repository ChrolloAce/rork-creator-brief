import { formats } from "./formats";

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

export function buildNavSections(): NavSection[] {
  return [
    {
      label: "Start here",
      items: [
        {
          id: overviewId,
          href: "/",
          title: "Overview",
          meta: "The brief",
        },
      ],
    },
    {
      label: "Formats",
      items: formats.map((f) => ({
        id: formatId(f.slug),
        href: `/formats/${f.slug}`,
        title: f.title,
        meta: f.tagline,
        thumbnail: f.thumbnail,
      })),
    },
  ];
}
