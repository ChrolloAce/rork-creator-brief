"use client";

import { useEffect, useState } from "react";
import type { BriefHookCategory } from "@/lib/db";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function HooksEditor({
  value,
  onSave,
}: {
  value: BriefHookCategory[] | null | undefined;
  onSave: (next: BriefHookCategory[] | null) => Promise<void>;
}) {
  const [cats, setCats] = useState<BriefHookCategory[]>(value ?? []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    setCats(value ?? []);
    setDirty(false);
  }, [value]);

  function mark() {
    setDirty(true);
  }

  function addCategory() {
    const t = newTitle.trim();
    if (!t) return;
    const slug = slugify(t) || `category-${cats.length + 1}`;
    setCats([...cats, { slug, title: t, hooks: [] }]);
    setNewTitle("");
    mark();
  }

  function removeCategory(idx: number) {
    if (!confirm("Delete this whole category?")) return;
    setCats(cats.filter((_, i) => i !== idx));
    mark();
  }

  function patchCategory(idx: number, patch: Partial<BriefHookCategory>) {
    setCats(cats.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    mark();
  }

  function addHook(idx: number) {
    const next = [...cats];
    next[idx] = { ...next[idx], hooks: [...next[idx].hooks, { text: "" }] };
    setCats(next);
    mark();
  }

  function patchHook(catIdx: number, hookIdx: number, text: string) {
    const next = [...cats];
    const hooks = [...next[catIdx].hooks];
    hooks[hookIdx] = { ...hooks[hookIdx], text };
    next[catIdx] = { ...next[catIdx], hooks };
    setCats(next);
    mark();
  }

  function removeHook(catIdx: number, hookIdx: number) {
    const next = [...cats];
    const hooks = next[catIdx].hooks.filter((_, i) => i !== hookIdx);
    next[catIdx] = { ...next[catIdx], hooks };
    setCats(next);
    mark();
  }

  async function submit() {
    setSaving(true);
    try {
      await onSave(cats.length === 0 ? null : cats);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Reset to the default hook library? All custom hooks lost."))
      return;
    setSaving(true);
    try {
      await onSave(null);
      setCats([]);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  const usingCustom = cats.length > 0;

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Hook library
          </div>
          <p className="text-xs text-muted mt-1">
            {usingCustom
              ? "Custom hooks — shown on every format for this brief."
              : "Using the shared default hook library. Add a category below to override."}
          </p>
        </div>
        <div className="flex gap-2">
          {usingCustom && (
            <button
              type="button"
              onClick={reset}
              className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || saving}
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs disabled:opacity-40"
          >
            {saving ? "…" : "Save hooks"}
          </button>
        </div>
      </div>

      {cats.map((c, ci) => (
        <div
          key={ci}
          className="border-2 border-line bg-paper rounded-md p-3 space-y-2"
        >
          <div className="flex gap-2 items-start flex-wrap">
            <input
              type="text"
              value={c.title}
              onChange={(e) => patchCategory(ci, { title: e.target.value })}
              placeholder="Category title"
              className="flex-1 min-w-[180px] border-2 border-line rounded-md px-2 py-1.5 text-base font-black focus:outline-none focus:border-accent bg-background"
            />
            <button
              type="button"
              onClick={() => removeCategory(ci)}
              aria-label="Delete category"
              className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-sm font-black"
            >
              × Delete
            </button>
          </div>
          <input
            type="text"
            value={c.summary ?? ""}
            onChange={(e) => patchCategory(ci, { summary: e.target.value })}
            placeholder="Short summary (optional)"
            className="w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
          <textarea
            value={c.whyItWorks ?? ""}
            onChange={(e) =>
              patchCategory(ci, { whyItWorks: e.target.value })
            }
            rows={2}
            placeholder="Why it works for this brand (optional)"
            className="w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
              Hooks ({c.hooks.length})
            </div>
            <ul className="space-y-1">
              {c.hooks.map((h, hi) => (
                <li key={hi} className="flex gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-muted pt-2 w-6 text-right">
                    {String(hi + 1).padStart(2, "0")}
                  </span>
                  <input
                    type="text"
                    value={h.text}
                    onChange={(e) => patchHook(ci, hi, e.target.value)}
                    placeholder="Hook text…"
                    className="flex-1 border-2 border-line rounded-md px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => removeHook(ci, hi)}
                    aria-label="Remove hook"
                    className="border-2 border-line bg-background w-8 rounded-md nb-press font-black"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addHook(ci)}
              className="mt-2 border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
            >
              + Add hook
            </button>
          </div>
        </div>
      ))}

      <div className="flex gap-2 items-center pt-1">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          placeholder="New category title…"
          className="flex-1 border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
        <button
          type="button"
          onClick={addCategory}
          disabled={!newTitle.trim()}
          className="border-2 border-line bg-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs disabled:opacity-40"
        >
          + Category
        </button>
      </div>
      {dirty && (
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Unsaved changes
        </p>
      )}
    </section>
  );
}
