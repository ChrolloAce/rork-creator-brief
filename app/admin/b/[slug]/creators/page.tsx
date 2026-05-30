import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrief, listCreators } from "@/lib/db";
import { CreatorsAdmin } from "@/components/admin/CreatorsAdmin";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export default async function CreatorsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const brief = await getBrief(slug);
  if (!brief) notFound();
  const creators = await listCreators(slug);

  // Map onboarding question ids → their labels for readable answers.
  const labels: Record<string, string> = {};
  for (const step of brief.onboarding?.steps ?? []) {
    for (const b of step.blocks) {
      if (b.kind === "question") labels[b.id] = b.label || "Question";
    }
  }

  const rows = creators.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    answers: c.answers,
  }));

  return (
    <main className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-20 bg-background border-b-2 border-line">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3 flex-wrap">
          <Link
            href={`/admin/b/${slug}`}
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            ← Editor
          </Link>
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              {brief.name}
            </div>
            <h1 className="text-xl font-black">Submissions &amp; access</h1>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
            {creators.length} total
          </span>
        </div>
      </header>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <CreatorsAdmin briefSlug={slug} initial={rows} questionLabels={labels} />
      </div>
    </main>
  );
}
