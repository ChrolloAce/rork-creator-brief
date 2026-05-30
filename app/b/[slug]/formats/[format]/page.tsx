import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { hookCategories as defaultHooks } from "@/lib/hooks";
import { formatId } from "@/lib/nav";
import { getBrief, getCuration } from "@/lib/db";
import type { HookCategory } from "@/lib/types";
import { getFormatsForRender } from "@/lib/format-videos";

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
  const [formats, curation] = await Promise.all([
    getFormatsForRender(brief.slug),
    getCuration(brief.slug),
  ]);
  // Format hidden on this brief — 404 so it doesn't leak via direct link.
  if (!formats.some((f) => f.slug === format)) notFound();
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
      activeId={formatId(format)}
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
      contentCalendar={curation.contentCalendar}
      onboardingEnabled={
        !!(brief.onboarding?.enabled && (brief.onboarding.steps?.length ?? 0) > 0)
      }
    />
  );
}
