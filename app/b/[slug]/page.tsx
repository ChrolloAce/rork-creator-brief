import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { hookCategories as defaultHooks } from "@/lib/hooks";
import { overviewId } from "@/lib/nav";
import { getBrief, getCuration } from "@/lib/db";
import type { HookCategory } from "@/lib/types";
import { getFormatsForRender } from "@/lib/format-videos";
import { briefAccessRequired, currentCreator, creatorHasAccess } from "@/lib/brief-gate";
import { getLang } from "@/lib/lang";
import { localizeBriefContent } from "@/lib/translate";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBrief(slug);
  if (!b) return { title: "Not found" };
  return {
    title: `${b.name} — Creator Brief`,
    description: `UGC creator brief for ${b.name}.`,
    openGraph: b.logoUrl ? { images: [{ url: b.logoUrl }] } : undefined,
  };
}

export default async function BriefOverview({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  // Gated brief: unapproved visitors must complete onboarding + enter the code.
  if (await briefAccessRequired(brief)) redirect(`/b/${brief.slug}/onboarding`);
  const [formats, curation] = await Promise.all([
    getFormatsForRender(brief.slug),
    getCuration(brief.slug),
  ]);
  // The content calendar is the main landing — if it's live, go straight there.
  const calLive =
    !!curation.contentCalendar?.enabled &&
    (curation.contentCalendar.days?.length ?? 0) > 0;
  if (calLive) {
    redirect(`/b/${brief.slug}/calendar`);
  }
  // Otherwise, if the overview is hidden, jump to the first visible format.
  if (curation.hideOverview && formats.length > 0) {
    redirect(`/b/${brief.slug}/formats/${formats[0].slug}`);
  }
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
  const lang = await getLang();
  const loc = await localizeBriefContent(lang, brief.slug, {
    overview: brief.overview,
    hookCategories: hooks,
    formats,
    contentCalendar: curation.contentCalendar ?? null,
  });
  return (
    <Shell
      formats={loc.formats ?? formats}
      hookCategories={loc.hookCategories ?? hooks}
      activeId={overviewId}
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
      contentCalendar={loc.contentCalendar ?? curation.contentCalendar}
      onboardingEnabled={
        !!(brief.onboarding?.enabled && (brief.onboarding.steps?.length ?? 0) > 0)
      }
      onboardingComplete={await creatorHasAccess(brief)}
      account={
        await currentCreator().then((u) =>
          u ? { name: u.name, email: u.email } : null
        )
      }
    />
  );
}
