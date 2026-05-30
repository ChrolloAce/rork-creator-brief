import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrief } from "@/lib/db";
import { OnboardingFlow } from "@/components/Onboarding";
import { currentCreator } from "@/lib/brief-gate";

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
  const user = await currentCreator();
  return (
    <OnboardingFlow
      onboarding={ob}
      brief={{ slug: brief.slug, name: brief.name, logoUrl: brief.logoUrl }}
      gated={!!(brief.accessEnabled && brief.accessCode)}
      account={user ? { name: user.name, email: user.email } : null}
    />
  );
}
