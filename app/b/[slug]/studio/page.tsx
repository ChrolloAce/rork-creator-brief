import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { hookCategories as defaultHooks } from "@/lib/hooks";
import { studioId } from "@/lib/nav";
import { getBrief, getCuration } from "@/lib/db";
import type { HookCategory } from "@/lib/types";
import { getFormatsForRender } from "@/lib/format-videos";
import { getHookVideos } from "@/lib/hook-videos";
import { briefAccessRequired, currentCreator, creatorHasAccess } from "@/lib/brief-gate";
import { getLang } from "@/lib/lang";
import { localizeBriefContent } from "@/lib/translate";
import { studioTitle } from "@/lib/studio";
import { studioViewer } from "@/lib/studio-auth";

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
  const curation = await getCuration(slug);
  return {
    title: `${studioTitle(curation.studio)} — ${brief.name} Creator Brief`,
    description: `Build post-ready videos for ${brief.name}.`,
  };
}

// The Video Builder page. Same shell as every other brief page so the sidebar,
// language toggle and account footer are where creators expect them.
export default async function BriefStudioPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  if (await briefAccessRequired(brief)) redirect(`/b/${brief.slug}/onboarding`);
  const hookVideos = await getHookVideos(brief.slug);
  const viewer = await studioViewer();
  const [formats, curation] = await Promise.all([
    getFormatsForRender(brief.slug, viewer?.id),
    getCuration(brief.slug),
  ]);
  // Off for creators unless enabled; admins can still open it to set up.
  if (!curation.studio?.enabled && !viewer?.isAdmin) notFound();

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
    contentCalendar: curation.contentCalendar ?? null,
  });
  const account = await currentCreator();
  return (
    <Shell
      formats={loc.formats ?? formats}
      hookCategories={loc.hookCategories ?? hooks}
      activeId={studioId}
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
      contentCalendar={loc.contentCalendar ?? curation.contentCalendar}
      hookVideos={hookVideos}
      onboardingEnabled={
        !!(brief.onboarding?.enabled && (brief.onboarding.steps?.length ?? 0) > 0)
      }
      onboardingComplete={await creatorHasAccess(brief)}
      account={account ? { name: account.name, email: account.email } : null}
      studio={{ title: studioTitle(curation.studio), signedIn: !!viewer }}
    />
  );
}
