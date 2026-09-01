import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { hookCategories as defaultHooks } from "@/lib/hooks";
import { formatId } from "@/lib/nav";
import { getBrief, getCuration } from "@/lib/db";
import type { HookCategory } from "@/lib/types";
import { getFormatsForRender } from "@/lib/format-videos";
import { getHookVideos } from "@/lib/hook-videos";
import { briefAccessRequired, currentCreator, creatorHasAccess } from "@/lib/brief-gate";
import { getLang } from "@/lib/lang";
import { localizeBriefContent } from "@/lib/translate";
import { studioTitle } from "@/lib/studio";

export const dynamic = "force-dynamic";

type Params = { slug: string; format: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, format } = await params;
  const brief = await getBrief(slug);
  if (!brief) return { title: "Not found" };
  // Look it up in the rendered format list so clones resolve too.
  const formats = await getFormatsForRender(brief.slug);
  const f = formats.find((x) => x.slug === format);
  if (!f) return { title: "Not found" };
  return {
    title: `${f.title} — ${brief.name} Creator Brief`,
    description: f.description,
  };
}

export default async function BriefFormatPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, format } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  if (await briefAccessRequired(brief)) redirect(`/b/${brief.slug}/onboarding`);
  const hookVideos = await getHookVideos(brief.slug);
  // Spreads creators across a format's live script variants.
  const viewer = await currentCreator();
  const [formats, curation] = await Promise.all([
    getFormatsForRender(brief.slug, viewer?.id),
    getCuration(brief.slug),
  ]);
  // Format hidden on this brief — 404 so it doesn't leak via direct link.
  if (!formats.some((f) => f.slug === format)) notFound();
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
    contentCalendar: curation.contentCalendar ?? null,
  });
  return (
    <Shell
      formats={loc.formats ?? formats}
      hookCategories={loc.hookCategories ?? hooks}
      activeId={formatId(format)}
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
      contentCalendar={loc.contentCalendar ?? curation.contentCalendar}
      hookVideos={hookVideos}
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
