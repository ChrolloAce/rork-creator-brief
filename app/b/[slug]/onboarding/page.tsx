import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBrief } from "@/lib/db";
import { OnboardingFlow } from "@/components/Onboarding";
import { currentCreator, creatorHasAccess } from "@/lib/brief-gate";
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
  const brief = await getBrief(slug);
  if (!brief) return { title: "Not found" };
  return {
    title: `Welcome — ${brief.name}`,
    description: `Onboarding for ${brief.name} creators.`,
  };
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  const ob = brief.onboarding;
  if (!ob?.enabled || (ob.steps?.length ?? 0) === 0) notFound();
  // Already approved (and not removed)? Skip onboarding → straight to the brief
  // (which lands on the content calendar).
  if (await creatorHasAccess(brief)) redirect(`/b/${brief.slug}`);
  const user = await currentCreator();
  const lang = await getLang();
  const loc = await localizeBriefContent(lang, brief.slug, { onboarding: ob });
  return (
    <OnboardingFlow
      onboarding={loc.onboarding ?? ob}
      brief={{ slug: brief.slug, name: brief.name, logoUrl: brief.logoUrl }}
      gated={!!(brief.accessEnabled && brief.accessCode)}
      requireLogin={brief.requireLogin}
      account={user ? { name: user.name, email: user.email } : null}
      lang={lang}
    />
  );
}
