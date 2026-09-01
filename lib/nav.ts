import type { Format } from "./types";
import { t, type Lang } from "./i18n";

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
export const studioId = "studio";
export const hooksId = "hooks";
export const formatId = (slug: string) => `format:${slug}`;

export function buildNavSections(
  formats: Format[],
  briefSlug: string,
  options?: {
    includeOverview?: boolean;
    includeCalendar?: boolean;
    includeOnboarding?: boolean;
    includeFormats?: boolean;
    includeHooks?: boolean;
    hooksCount?: number;
    onboardingComplete?: boolean;
    lang?: Lang;
    // Video Builder (lib/studio.ts). Listed first when on: for the briefs
    // that have it, making the video is the whole job.
    studio?: { title: string } | null;
  }
): NavSection[] {
  const base = `/b/${briefSlug}`;
  const lang = options?.lang ?? "en";
  const includeOverview = options?.includeOverview !== false;
  const includeCalendar = options?.includeCalendar === true;
  const includeOnboarding = options?.includeOnboarding === true;
  const includeFormats = options?.includeFormats !== false;
  const includeHooks = options?.includeHooks === true;
  const onboardingComplete = options?.onboardingComplete === true;
  const sections: NavSection[] = [];
  if (options?.studio) {
    sections.push({
      label: t(lang, "makeSection"),
      items: [
        {
          id: studioId,
          href: `${base}/studio`,
          title: options.studio.title,
          meta: t(lang, "studioMeta"),
        },
      ],
    });
  }
  // The content calendar is the main thing — list it first.
  if (includeCalendar) {
    sections.push({
      label: t(lang, "plan"),
      items: [
        {
          id: calendarId,
          href: `${base}/calendar`,
          title: t(lang, "contentCalendar"),
          meta: t(lang, "calendarMeta"),
        },
      ],
    });
  }
  const startItems: NavSection["items"] = [];
  if (includeOnboarding) {
    startItems.push({
      id: onboardingId,
      href: `${base}/onboarding`,
      title: t(lang, "onboarding"),
      meta: onboardingComplete
        ? t(lang, "onboardingComplete")
        : t(lang, "startHere"),
    });
  }
  if (includeOverview) {
    startItems.push({
      id: overviewId,
      href: base,
      title: t(lang, "overview"),
      meta: t(lang, "overviewMeta"),
    });
  }
  if (startItems.length > 0) {
    sections.push({ label: t(lang, "startHere"), items: startItems });
  }
  if (includeHooks) {
    const n = options?.hooksCount ?? 0;
    sections.push({
      label: t(lang, "hooks"),
      items: [
        {
          id: hooksId,
          href: `${base}/hooks`,
          title: t(lang, "hooks"),
          meta: n > 0 ? `${n} ${t(lang, "videosWordLower")}` : t(lang, "hooksMeta"),
        },
      ],
    });
  }
  if (includeFormats) {
    sections.push({
      label: t(lang, "formats"),
      items: formats.map((f) => ({
        id: formatId(f.slug),
        href: `${base}/formats/${f.slug}`,
        title: f.title,
        meta: f.tagline,
        thumbnail: f.thumbnail,
      })),
    });
  }
  return sections;
}
