import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { hookCategories as defaultHooks } from "@/lib/hooks";
import { hooksId } from "@/lib/nav";
import { getBrief, getCuration } from "@/lib/db";
import { getHookVideos } from "@/lib/hook-videos";
import type { HookCategory } from "@/lib/types";
import { getFormatsForRender } from "@/lib/format-videos";
import { briefAccessRequired, currentCreator, creatorHasAccess } from "@/lib/brief-gate";
import { getLang } from "@/lib/lang";
import { localizeBriefContent } from "@/lib/translate";
import { studioTitle } from "@/lib/studio";

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
    title: `Hooks — ${brief.name} Creator Brief`,
    description: `Viral reference reels for ${brief.name}.`,
  };
}

export default async function BriefHooksPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  if (await briefAccessRequired(brief)) redirect(`/b/${brief.slug}/onboarding`);
  const viewer = await currentCreator();
  const [formats, curation, hookVideos] = await Promise.all([
    getFormatsForRender(brief.slug, viewer?.id),
    getCuration(brief.slug),
    getHookVideos(brief.slug),
  ]);
  if (hookVideos.length === 0) notFound();
  const onboardingComplete = await creatorHasAccess(brief);

  const hooks: HookCategory[] =
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
    contentCalendar: curation.contentCalendar,
  });
  return (
    <Shell
      formats={loc.formats ?? formats}
      hookCategories={loc.hookCategories ?? hooks}
      activeId={hooksId}
      lang={lang}
      brief={{
        slug: brief.slug,
        name: brief.name,
        logoUrl: brief.logoUrl,
        overview: loc.overview ?? brief.overview,
      }}
      useAllHooks={!!(brief.hookCategories && brief.hookCategories.length > 0)}
      publicStats={curation.publicStats}
      hideOverview={curation.hideOverview}
      hideFormatsList={curation.hideFormatsList}
      studio={curation.studio?.enabled ? { title: studioTitle(curation.studio) } : null}
      contentCalendar={loc.contentCalendar ?? curation.contentCalendar}
      hookVideos={hookVideos}
      onboardingEnabled={
        !!(brief.onboarding?.enabled && (brief.onboarding.steps?.length ?? 0) > 0)
      }
      onboardingComplete={onboardingComplete}
      account={viewer ? { name: viewer.name, email: viewer.email } : null}
    />
  );
}
