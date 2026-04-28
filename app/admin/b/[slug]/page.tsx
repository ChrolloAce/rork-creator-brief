import { notFound } from "next/navigation";
import { getBrief } from "@/lib/db";
import { BriefEditor } from "@/components/admin/BriefEditor";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export default async function AdminBriefEditorPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  return <BriefEditor briefSlug={slug} />;
}
