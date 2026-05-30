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
export const calendarId = "calendar";
export const onboardingId = "onboarding";
export const formatId = (slug: string) => `format:${slug}`;

export function buildNavSections(
  formats: Format[],
  briefSlug: string,
  options?: {
    includeOverview?: boolean;
    includeCalendar?: boolean;
    includeOnboarding?: boolean;
  }
): NavSection[] {
  const base = `/b/${briefSlug}`;
  const includeOverview = options?.includeOverview !== false;
  const includeCalendar = options?.includeCalendar === true;
  const includeOnboarding = options?.includeOnboarding === true;
  const sections: NavSection[] = [];
  const startItems: NavSection["items"] = [];
  if (includeOnboarding) {
    startItems.push({
      id: onboardingId,
      href: `${base}/onboarding`,
      title: "Onboarding",
      meta: "Start here",
    });
  }
  if (includeOverview) {
    startItems.push({
      id: overviewId,
      href: base,
      title: "Overview",
      meta: "The brief",
    });
  }
  if (startItems.length > 0) {
    sections.push({ label: "Start here", items: startItems });
  }
  if (includeCalendar) {
    sections.push({
      label: "Plan",
      items: [
        {
          id: calendarId,
          href: `${base}/calendar`,
          title: "Content Calendar",
          meta: "What to film each day",
        },
      ],
    });
  }
  sections.push({
    label: "Formats",
    items: formats.map((f) => ({
      id: formatId(f.slug),
      href: `${base}/formats/${f.slug}`,
      title: f.title,
      meta: f.tagline,
      thumbnail: f.thumbnail,
    })),
  });
  return sections;
}
