"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoUpload } from "@/components/admin/LogoUpload";
import { FormTemplatesSection } from "@/components/admin/FormTemplatesSection";

type Brief = {
  slug: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function AdminDashboard() {
  const [briefs, setBriefs] = useState<Brief[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  async function load() {
    const r = await fetch("/api/briefs", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setBriefs(j.briefs);
    else setLoadError(j.error ?? "failed to load");
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateErr(null);
    const body = {
      name,
      slug: slug || slugify(name),
      logoUrl: logoUrl.trim() || undefined,
    };
    const res = await fetch("/api/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setCreating(false);
    if (res.ok) {
      window.location.href = `/admin/b/${j.brief.slug}`;
    } else {
      setCreateErr(j.error ?? "failed to create");
    }
  }

  async function onDelete(briefSlug: string) {
    if (briefSlug === "rork") return;
    if (!confirm(`Delete brief "${briefSlug}"? This can't be undone.`)) return;
    const res = await fetch(`/api/briefs/${briefSlug}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const j = await res.json();
      alert(`Failed: ${j.error ?? res.status}`);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <main className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-20 bg-background border-b-2 border-line">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Admin · Dashboard
            </div>
            <h1 className="text-xl font-black">Briefs</h1>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 border-line rounded-sm bg-[#86efac] text-[#064e2f]">
            DB live
          </span>
          <button
            onClick={onLogout}
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        {loadError && (
          <p className="text-sm text-[#b91c1c] border-2 border-line bg-[#fee2e2] px-3 py-2 rounded-sm">
            {loadError}
          </p>
        )}

        <section>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
            Existing briefs
          </div>
          {!briefs ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : briefs.length === 0 ? (
            <p className="text-sm text-muted italic">No briefs yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {briefs.map((b) => (
                <div
                  key={b.slug}
                  className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 border-2 border-line bg-paper rounded-sm overflow-hidden flex items-center justify-center shrink-0">
                      {b.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={b.logoUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-sm font-black uppercase">
                          {b.name.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-ink truncate">
                        {b.name}
                      </div>
                      <div className="text-[11px] text-muted font-mono truncate">
                        {b.slug}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link
                      href={`/admin/b/${b.slug}`}
                      className="flex-1 text-center border-2 border-line bg-ink text-background text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-sm nb-press"
                    >
                      Edit
                    </Link>
                    <a
                      href={`/b/${b.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-center border-2 border-line bg-background text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-sm nb-press"
                    >
                      View ↗
                    </a>
                    {b.slug !== "rork" && (
                      <button
                        type="button"
                        onClick={() => onDelete(b.slug)}
                        className="border-2 border-line bg-background text-xs font-black px-2 py-1.5 rounded-sm nb-press"
                        aria-label={`Delete ${b.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <FormTemplatesSection briefs={briefs ?? []} />

        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
            Create a new brief
          </div>
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug || slug === slugify(name))
                    setSlug(slugify(e.target.value));
                }}
                placeholder="Acme App"
                required
                className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-black focus:outline-none focus:border-accent bg-background"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Slug
              </span>
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="acme-app"
                className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-accent bg-background"
              />
            </label>
            <div className="block sm:col-span-3">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Logo (optional)
              </span>
              <div className="mt-1">
                <LogoUpload
                  value={logoUrl || null}
                  onChange={(v) => setLogoUrl(v ?? "")}
                />
              </div>
            </div>
            <div className="sm:col-span-3 flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press disabled:opacity-40"
              >
                {creating ? "Creating…" : "Create brief"}
              </button>
              {createErr && (
                <span className="text-xs font-bold text-[#b91c1c]">
                  {createErr}
                </span>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
