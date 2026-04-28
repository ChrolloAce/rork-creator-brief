"use client";

import { useEffect, useState } from "react";
import type { BriefOverview } from "@/lib/db";

export function OverviewEditor({
  value,
  onSave,
}: {
  value: BriefOverview | null | undefined;
  onSave: (next: BriefOverview) => Promise<void>;
}) {
  const [form, setForm] = useState<BriefOverview>(value ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(value ?? {});
    setDirty(false);
  }, [value]);

  function update<K extends keyof BriefOverview>(
    key: K,
    v: BriefOverview[K]
  ) {
    setForm((f) => ({ ...f, [key]: v }));
    setDirty(true);
  }

  function updateList(
    key: "valueProps" | "audience",
    text: string
  ) {
    const items = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    update(key, items);
  }

  async function submit() {
    setSaving(true);
    try {
      await onSave(form);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Overview page content
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!dirty || saving}
          className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs disabled:opacity-40"
        >
          {saving ? "…" : "Save overview"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Hero headline
          </span>
          <input
            type="text"
            value={form.heroHeadline ?? ""}
            onChange={(e) => update("heroHeadline", e.target.value)}
            placeholder="Ship content that ships apps."
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-lg font-black focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Hero accent word (highlighted)
          </span>
          <input
            type="text"
            value={form.heroAccentWord ?? ""}
            onChange={(e) => update("heroAccentWord", e.target.value)}
            placeholder="apps"
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Tagline
          </span>
          <input
            type="text"
            value={form.tagline ?? ""}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="Be the next one."
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Hero sub-text
          </span>
          <textarea
            value={form.heroSubtext ?? ""}
            onChange={(e) => update("heroSubtext", e.target.value)}
            rows={3}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Product heading
          </span>
          <input
            type="text"
            value={form.productHeading ?? ""}
            onChange={(e) => update("productHeading", e.target.value)}
            placeholder="What Rork is"
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Tagline sub-text
          </span>
          <input
            type="text"
            value={form.taglineSub ?? ""}
            onChange={(e) => update("taglineSub", e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Product description
          </span>
          <textarea
            value={form.productDescription ?? ""}
            onChange={(e) => update("productDescription", e.target.value)}
            rows={4}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Value props (one per line)
          </span>
          <textarea
            value={(form.valueProps ?? []).join("\n")}
            onChange={(e) => updateList("valueProps", e.target.value)}
            rows={5}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed font-mono"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Audience (one per line)
          </span>
          <textarea
            value={(form.audience ?? []).join("\n")}
            onChange={(e) => updateList("audience", e.target.value)}
            rows={5}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed font-mono"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            How to use (accent block)
          </span>
          <textarea
            value={form.howToUse ?? ""}
            onChange={(e) => update("howToUse", e.target.value)}
            rows={3}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </label>
      </div>
      {dirty && (
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mt-2">
          Unsaved changes
        </p>
      )}
    </section>
  );
}
