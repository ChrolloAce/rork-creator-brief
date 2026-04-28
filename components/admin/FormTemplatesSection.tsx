"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FORM_PRESETS, getPreset } from "@/lib/form-presets";

type Template = {
  slug: string;
  name: string;
  description: string | null;
  briefSlug: string | null;
  fields: unknown[];
  responseCount: number;
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

export function FormTemplatesSection({
  briefs,
}: {
  briefs: { slug: string; name: string }[];
}) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [briefSlug, setBriefSlug] = useState<string>("");
  const [presetId, setPresetId] = useState<string>("blank");

  async function load() {
    const r = await fetch("/api/form-templates", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setTemplates(j.templates);
    else setLoadError(j.error ?? "failed to load");
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateErr(null);
    const preset = getPreset(presetId);
    const body = {
      name,
      slug: slug || slugify(name),
      briefSlug: briefSlug || null,
      description: preset?.body.description || undefined,
      submitMessage: preset?.body.submitMessage || undefined,
      fields: preset?.body.fields ?? [],
    };
    const res = await fetch("/api/form-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setCreating(false);
    if (res.ok) {
      window.location.href = `/admin/forms/${j.template.slug}`;
    } else {
      setCreateErr(j.error ?? "failed to create");
    }
  }

  async function onDelete(s: string) {
    if (
      !confirm(`Delete form "${s}" and all its responses? This can't be undone.`)
    )
      return;
    const res = await fetch(`/api/form-templates/${s}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const j = await res.json();
      alert(`Failed: ${j.error ?? res.status}`);
    }
  }

  return (
    <section>
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
        Application forms
      </div>
      {loadError && (
        <p className="text-sm text-[#b91c1c] border-2 border-line bg-[#fee2e2] px-3 py-2 rounded-sm mb-3">
          {loadError}
        </p>
      )}
      {!templates ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted italic mb-4">
          No forms yet. Create one below.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          {templates.map((t) => (
            <div
              key={t.slug}
              className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 flex flex-col gap-3"
            >
              <div>
                <div className="font-black text-ink truncate">{t.name}</div>
                <div className="text-[11px] text-muted font-mono truncate">
                  {t.slug}
                </div>
                <div className="text-[11px] text-muted mt-1">
                  {t.fields.length} {t.fields.length === 1 ? "field" : "fields"}
                  {" · "}
                  {t.responseCount}{" "}
                  {t.responseCount === 1 ? "response" : "responses"}
                  {t.briefSlug && (
                    <>
                      {" · "}
                      <span className="font-mono">{t.briefSlug}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/admin/forms/${t.slug}`}
                  className="flex-1 text-center border-2 border-line bg-ink text-background text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-sm nb-press"
                >
                  Edit
                </Link>
                <a
                  href={`/apply/${t.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center border-2 border-line bg-background text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-sm nb-press"
                >
                  Open ↗
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(t.slug)}
                  className="border-2 border-line bg-background text-xs font-black px-2 py-1.5 rounded-sm nb-press"
                  aria-label={`Delete ${t.name}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={onCreate}
        className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5 grid gap-3 sm:grid-cols-3"
      >
        <div className="sm:col-span-3 text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          New application form
        </div>
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
            placeholder="UGC Creator Application"
            required
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-black focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Slug (URL)
          </span>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="ugc-application"
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Linked brief (optional)
          </span>
          <select
            value={briefSlug}
            onChange={(e) => setBriefSlug(e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          >
            <option value="">— none —</option>
            {briefs.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-3">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Start from template
          </span>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          >
            {FORM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.description}
              </option>
            ))}
          </select>
          {presetId !== "blank" && (
            <p className="text-[11px] text-muted mt-1">
              {getPreset(presetId)?.body.fields.length ?? 0} fields will be
              pre-populated. You can edit them after.
            </p>
          )}
        </label>
        <div className="sm:col-span-3 flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create form"}
          </button>
          {createErr && (
            <span className="text-xs font-bold text-[#b91c1c]">{createErr}</span>
          )}
        </div>
      </form>
    </section>
  );
}
