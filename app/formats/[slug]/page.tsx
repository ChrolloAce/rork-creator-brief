import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { formats } from "@/lib/formats";
import { hookCategories } from "@/lib/hooks";
import { formatId } from "@/lib/nav";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return formats.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const f = formats.find((x) => x.slug === slug);
  if (!f) return { title: "Not found" };
  return {
    title: `${f.title} — Rork Creator Brief`,
    description: f.description,
    openGraph: {
      title: `${f.title} — Rork Creator Brief`,
      description: f.description,
      images: f.thumbnail ? [{ url: f.thumbnail }] : undefined,
    },
  };
}

export default async function FormatPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const f = formats.find((x) => x.slug === slug);
  if (!f) notFound();
  return (
    <Shell
      formats={formats}
      hookCategories={hookCategories}
      activeId={formatId(slug)}
    />
  );
}
