import { notFound } from "next/navigation";
import { getFormTemplate, getBrief } from "@/lib/db";
import { PublicApplyForm } from "@/components/PublicApplyForm";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export default async function ApplyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const template = await getFormTemplate(slug);
  if (!template) notFound();
  const brief = template.briefSlug ? await getBrief(template.briefSlug) : null;

  return (
    <main className="min-h-screen bg-background text-ink">
      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        <header className="mb-6">
          {brief?.logoUrl && (
            <div className="mb-4 w-16 h-16 border-2 border-line bg-paper rounded-sm overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brief.logoUrl}
                alt={brief.name}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
            Application{brief ? ` · ${brief.name}` : ""}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">
            {template.name}
          </h1>
          {template.description && (
            <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
              {template.description}
            </p>
          )}
        </header>
        <PublicApplyForm
          slug={template.slug}
          fields={template.fields}
          submitMessage={template.submitMessage}
        />
      </div>
    </main>
  );
}
