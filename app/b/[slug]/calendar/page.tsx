import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { hookCategories as defaultHooks } from "@/lib/hooks";
import { calendarId } from "@/lib/nav";
import { getBrief, getCuration } from "@/lib/db";
import type { HookCategory } from "@/lib/types";
import { getFormatsForRender } from "@/lib/format-videos";
import { briefAccessRequired, currentCreator, creatorHasAccess } from "@/lib/brief-gate";
import { getLang } from "@/lib/lang";
import { localizeBriefContent } from "@/lib/translate";
import { studioTitle } from "@/lib/studio";
import { resolveCalendarForCreator } from "@/lib/rotation";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) return { title: "Not found" };
  return {
    title: `Content Calendar — ${brief.name} Creator Brief`,
    description: `What to film each day for ${brief.name}.`,
  };
}

export default async function BriefCalendarPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  if (await briefAccessRequired(brief)) redirect(`/b/${brief.slug}/onboarding`);
  const viewer = await currentCreator();
  const [formats, curation] = await Promise.all([
    getFormatsForRender(brief.slug, viewer?.id),
    getCuration(brief.slug),
  ]);
  const rawCalendar = curation.contentCalendar;
  // Only expose the calendar when it's enabled and actually has something to
  // show. An auto-rotation counts: its days are generated per creator below,
  // so `days` is legitimately empty while the calendar is full.
  const hasRotation =
    !!rawCalendar?.autoRotation?.enabled &&
    (rawCalendar.autoRotation.slugs?.length ?? 0) > 0;
  if (
    !rawCalendar?.enabled ||
    ((rawCalendar.days?.length ?? 0) === 0 && !hasRotation)
  ) {
    notFound();
  }

  const account = viewer;
  // Hand this creator their own slice of any day that carries a rotation pool.
  // Days without a pool resolve to exactly what everyone saw before.
  const calendar = resolveCalendarForCreator(rawCalendar, account?.id);
  const onboardingComplete = await creatorHasAccess(brief);

  const hooks: HookCategory[] =
    // `null` means the brief never set hooks, so it inherits the built-in
    // library. An explicitly EMPTY array means this brief deliberately has
    // none: a new client's brief must not fall back to the previous client's
    // hook copy, which used to leak into the page payload.
    brief.hookCategories != null
      ? brief.hookCategories.map((c) => ({
          slug: c.slug,
          title: c.title,
          summary: c.summary ?? "",
          whyItWorks: c.whyItWorks ?? "",
          hooks: c.hooks,
        }))
      : defaultHooks;
  const lang = await getLang();
  const loc = await localizeBriefContent(lang, brief.slug, {
    overview: brief.overview,
    hookCategories: hooks,
    formats,
    contentCalendar: calendar,
  });
  return (
    <Shell
      formats={loc.formats ?? formats}
      hookCategories={loc.hookCategories ?? hooks}
      activeId={calendarId}
      lang={lang}
      brief={{
        slug: brief.slug,
        name: brief.name,
        logoUrl: brief.logoUrl,
        overview: loc.overview ?? brief.overview,
      }}
      useAllHooks={
        !!(brief.hookCategories && brief.hookCategories.length > 0)
      }
      publicStats={curation.publicStats}
      hideOverview={curation.hideOverview}
      hideFormatsList={curation.hideFormatsList}
      studio={curation.studio?.enabled ? { title: studioTitle(curation.studio) } : null}
      contentCalendar={loc.contentCalendar ?? calendar}
      onboardingEnabled={
        !!(brief.onboarding?.enabled && (brief.onboarding.steps?.length ?? 0) > 0)
      }
      onboardingComplete={onboardingComplete}
      account={account ? { name: account.name, email: account.email } : null}
    />
  );
}
