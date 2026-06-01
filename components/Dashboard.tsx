"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type BriefCard = { slug: string; name: string; logoUrl: string | null };

export function Dashboard({
  user,
  briefs,
}: {
  user: { name: string | null; email: string };
  briefs: BriefCard[];
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
              SuperBrief
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Hi{user.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="text-sm text-muted mt-1">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="border-2 border-line bg-background px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            Log out
          </button>
        </header>

        {/* Briefs */}
        <section className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Your briefs
          </div>

          {briefs.length === 0 ? (
            <div className="border-2 border-line border-dashed rounded-md bg-paper p-8 text-center space-y-2">
              <div className="text-2xl">📭</div>
              <h2 className="text-lg font-black">No briefs yet</h2>
              <p className="text-sm text-muted max-w-md mx-auto">
                You don&apos;t have access to any briefs yet. Open the brief link
                your manager sent you and complete onboarding — it&apos;ll show up
                here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {briefs.map((b) => (
                <Link
                  key={b.slug}
                  href={`/b/${b.slug}`}
                  className="group border-2 border-line bg-background rounded-md nb-shadow-sm hover:nb-shadow p-5 flex items-center gap-4 transition-shadow"
                >
                  <div className="w-14 h-14 shrink-0 border-2 border-line rounded-md overflow-hidden bg-paper flex items-center justify-center">
                    {b.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={b.logoUrl}
                        alt={b.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-muted">
                        {b.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-ink truncate">{b.name}</div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-muted group-hover:text-accent">
                      Open brief →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
