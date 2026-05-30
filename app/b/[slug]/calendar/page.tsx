import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { hookCategories as defaultHooks } from "@/lib/hooks";
import { calendarId } from "@/lib/nav";
import { getBrief, getCuration } from "@/lib/db";
import type { HookCategory } from "@/lib/types";
import { getFormatsForRender } from "@/lib/format-videos";
import { briefAccessRequired } from "@/lib/brief-gate";

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
  const [formats, curation] = await Promise.all([
    getFormatsForRender(brief.slug),
    getCuration(brief.slug),
  ]);
  const calendar = curation.contentCalendar;
  // Only expose the calendar when it's enabled and has at least one day —
  // otherwise the direct link shouldn't leak an empty page.
  if (!calendar?.enabled || (calendar.days?.length ?? 0) === 0) notFound();

  const hooks: HookCategory[] =
    brief.hookCategories && brief.hookCategories.length > 0
      ? brief.hookCategories.map((c) => ({
          slug: c.slug,
          title: c.title,
          summary: c.summary ?? "",
          whyItWorks: c.whyItWorks ?? "",
          hooks: c.hooks,
        }))
      : defaultHooks;
  return (
    <Shell
      formats={formats}
      hookCategories={hooks}
      activeId={calendarId}
      brief={{
        slug: brief.slug,
        name: brief.name,
        logoUrl: brief.logoUrl,
        overview: brief.overview,
      }}
      useAllHooks={
        !!(brief.hookCategories && brief.hookCategories.length > 0)
      }
      publicStats={curation.publicStats}
      hideOverview={curation.hideOverview}
      contentCalendar={calendar}
      onboardingEnabled={
        !!(brief.onboarding?.enabled && (brief.onboarding.steps?.length ?? 0) > 0)
      }
    />
  );
}
