import { notFound } from "next/navigation";
import { getFormTemplate } from "@/lib/db";
import { FormTemplateEditor } from "@/components/admin/FormTemplateEditor";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export default async function AdminFormTemplateEditorPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const template = await getFormTemplate(slug);
  if (!template) notFound();
  return <FormTemplateEditor slug={slug} />;
}
