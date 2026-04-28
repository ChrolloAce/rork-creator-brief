"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormField, FormFieldType, FormResponse } from "@/lib/db";

function ResponseValue({
  field,
  value,
}: {
  field: FormField;
  value: unknown;
}) {
  if (value === null || value === undefined || value === "") return <>—</>;
  if (field.type === "image" && typeof value === "string") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt={field.label}
          className="w-24 h-24 object-cover border-2 border-line rounded-sm"
        />
      </a>
    );
  }
  if (field.type === "account_list" && Array.isArray(value)) {
    if (value.length === 0) return <>—</>;
    return (
      <ul className="space-y-1">
        {value.map((entry, i) => {
          const e = entry as { platform?: string; handle?: string };
          return (
            <li key={i} className="font-mono text-xs">
              <span className="text-muted">{e.platform || "—"}:</span>{" "}
              {e.handle || "—"}
            </li>
          );
        })}
      </ul>
    );
  }
  if (field.type === "password" && typeof value === "string") {
    return (
      <PasswordReveal value={value} />
    );
  }
  if (typeof value === "boolean") return <>{value ? "yes" : "no"}</>;
  return <>{String(value)}</>;
}

function PasswordReveal({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">
        {shown ? value : "•".repeat(Math.min(value.length, 12))}
      </span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="text-[10px] uppercase tracking-[0.2em] font-bold border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press"
      >
        {shown ? "hide" : "show"}
      </button>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value)}
        className="text-[10px] uppercase tracking-[0.2em] font-bold border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press"
      >
        copy
      </button>
    </span>
  );
}

type Template = {
  slug: string;
  name: string;
  description: string | null;
  briefSlug: string | null;
  fields: FormField[];
  submitMessage: string | null;
};

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (single choice)" },
  { value: "checkbox", label: "Checkbox (yes/no)" },
  { value: "password", label: "Password (masked)" },
  { value: "image", label: "Image upload" },
  { value: "account_list", label: "Social accounts (multiple)" },
];

function genId(): string {
  return `f_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function FormTemplateEditor({ slug }: { slug: string }) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [briefs, setBriefs] = useState<{ slug: string; name: string }[]>([]);
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function load() {
    const [r1, r2, r3] = await Promise.all([
      fetch(`/api/form-templates/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      }),
      fetch("/api/briefs", { cache: "no-store" }),
      fetch(`/api/form-templates/${encodeURIComponent(slug)}/responses`, {
        cache: "no-store",
      }),
    ]);
    const j1 = await r1.json();
    const j2 = await r2.json();
    const j3 = await r3.json();
    if (j1.ok) setTemplate(j1.template);
    else setLoadError(j1.error ?? "failed to load");
    if (j2.ok) setBriefs(j2.briefs);
    if (j3.ok) setResponses(j3.responses);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function persist(patch: Partial<Template>) {
    if (!template) return;
    setSaving(true);
    const res = await fetch(
      `/api/form-templates/${encodeURIComponent(template.slug)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    const j = await res.json();
    setSaving(false);
    if (res.ok) {
      setTemplate(j.template);
      if (patch.slug && j.template.slug !== template.slug) {
        window.location.href = `/admin/forms/${j.template.slug}`;
        return;
      }
      setSaveMsg(`Saved ✓`);
      setTimeout(() => setSaveMsg(null), 2000);
    } else {
      setSaveMsg(`ERR: ${j.error ?? res.status}`);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  if (loadError) {
    return (
      <main className="p-8">
        <p className="text-sm text-[#b91c1c]">Failed to load: {loadError}</p>
      </main>
    );
  }
  if (!template) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  function update<K extends keyof Template>(key: K, v: Template[K]) {
    setTemplate((t) => (t ? { ...t, [key]: v } : t));
  }

  function addField() {
    if (!template) return;
    const next: FormField = {
      id: genId(),
      type: "short_text",
      label: "New question",
      required: false,
    };
    update("fields", [...template.fields, next]);
  }

  function updateField(idx: number, patch: Partial<FormField>) {
    if (!template) return;
    const next = template.fields.map((f, i) =>
      i === idx ? { ...f, ...patch } : f
    );
    update("fields", next);
  }

  function removeField(idx: number) {
    if (!template) return;
    update(
      "fields",
      template.fields.filter((_, i) => i !== idx)
    );
  }

  function moveField(idx: number, dir: -1 | 1) {
    if (!template) return;
    const target = idx + dir;
    if (target < 0 || target >= template.fields.length) return;
    const next = [...template.fields];
    [next[idx], next[target]] = [next[target], next[idx]];
    update("fields", next);
  }

  return (
    <main className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-20 bg-background border-b-2 border-line">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3 flex-wrap">
          <Link
            href="/admin"
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            ← Admin
          </Link>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Form · {template.slug}
            </div>
            <h1 className="text-xl font-black">{template.name}</h1>
          </div>
          <a
            href={`/apply/${template.slug}`}
            target="_blank"
            rel="noreferrer"
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            Public ↗
          </a>
          <button
            onClick={() =>
              persist({
                name: template.name,
                slug: template.slug,
                description: template.description,
                briefSlug: template.briefSlug,
                fields: template.fields,
                submitMessage: template.submitMessage,
              })
            }
            disabled={saving}
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press disabled:opacity-40"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            onClick={onLogout}
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            Log out
          </button>
        </div>
        {saveMsg && (
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <p className="text-xs font-bold border-2 border-line bg-paper px-2 py-1.5 rounded-sm">
              {saveMsg}
            </p>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
            Form settings
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Name
              </span>
              <input
                type="text"
                value={template.name}
                onChange={(e) => update("name", e.target.value)}
                className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-black focus:outline-none focus:border-accent bg-background"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Slug (URL)
              </span>
              <input
                type="text"
                value={template.slug}
                onChange={(e) =>
                  update("slug", slugify(e.target.value))
                }
                className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-accent bg-background"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Description (shown above the form)
              </span>
              <textarea
                value={template.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Linked brief (optional)
              </span>
              <select
                value={template.briefSlug ?? ""}
                onChange={(e) =>
                  update("briefSlug", e.target.value || null)
                }
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
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Submit success message
              </span>
              <input
                type="text"
                value={template.submitMessage ?? ""}
                onChange={(e) => update("submitMessage", e.target.value)}
                placeholder="Thanks — we'll be in touch."
                className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
              />
            </label>
          </div>
        </section>

        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Questions ({template.fields.length})
            </div>
            <button
              type="button"
              onClick={addField}
              className="border-2 border-line bg-ink text-background text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press"
            >
              + Add question
            </button>
          </div>
          {template.fields.length === 0 ? (
            <p className="text-sm text-muted italic">
              No questions yet. Add one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {template.fields.map((f, idx) => (
                <li
                  key={f.id}
                  className="border-2 border-line bg-paper rounded-md p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <code className="font-mono text-[11px] text-muted border-2 border-line bg-background px-1.5 py-0.5 rounded-sm">
                      {f.id}
                    </code>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(idx, -1)}
                        disabled={idx === 0}
                        aria-label="Move up"
                        className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, 1)}
                        disabled={idx === template.fields.length - 1}
                        aria-label="Move down"
                        className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove "${f.label}"?`))
                            removeField(idx);
                        }}
                        aria-label="Remove"
                        className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                        Question label
                      </span>
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) =>
                          updateField(idx, { label: e.target.value })
                        }
                        className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-bold focus:outline-none focus:border-accent bg-background"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                        Type
                      </span>
                      <select
                        value={f.type}
                        onChange={(e) =>
                          updateField(idx, {
                            type: e.target.value as FormFieldType,
                          })
                        }
                        className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
                      >
                        {FIELD_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 mt-5">
                      <input
                        type="checkbox"
                        checked={!!f.required}
                        onChange={(e) =>
                          updateField(idx, { required: e.target.checked })
                        }
                        className="w-4 h-4 border-2 border-line"
                      />
                      <span className="text-xs font-bold">Required</span>
                    </label>
                    {f.type !== "checkbox" && (
                      <label className="block sm:col-span-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                          Placeholder (optional)
                        </span>
                        <input
                          type="text"
                          value={f.placeholder ?? ""}
                          onChange={(e) =>
                            updateField(idx, { placeholder: e.target.value })
                          }
                          className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
                        />
                      </label>
                    )}
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                        Help text (optional)
                      </span>
                      <input
                        type="text"
                        value={f.helpText ?? ""}
                        onChange={(e) =>
                          updateField(idx, { helpText: e.target.value })
                        }
                        className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
                      />
                    </label>
                    {f.type === "select" && (
                      <label className="block sm:col-span-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                          Options (one per line)
                        </span>
                        <textarea
                          value={(f.options ?? []).join("\n")}
                          onChange={(e) =>
                            updateField(idx, {
                              options: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          rows={4}
                          className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background font-mono"
                        />
                      </label>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ResponsesSection
          template={template}
          responses={responses}
          onReload={load}
        />
      </div>
    </main>
  );
}

function ResponsesSection({
  template,
  responses,
}: {
  template: Template;
  responses: FormResponse[] | null;
  onReload: () => Promise<void>;
}) {
  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Responses ({responses?.length ?? 0})
        </div>
      </div>
      {!responses ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : responses.length === 0 ? (
        <p className="text-sm text-muted italic">
          No submissions yet. Share{" "}
          <code className="font-mono">/apply/{template.slug}</code> with
          creators.
        </p>
      ) : (
        <ul className="space-y-3">
          {responses.map((r) => (
            <li
              key={r.id}
              className="border-2 border-line bg-paper rounded-md p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <code className="font-mono text-[11px] text-muted">
                  {r.id}
                </code>
                <span className="text-[11px] text-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <dl className="grid gap-1 text-sm">
                {template.fields.map((f) => {
                  const v = r.data[f.id];
                  return (
                    <div
                      key={f.id}
                      className="grid grid-cols-[140px_1fr] gap-2 items-baseline"
                    >
                      <dt className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted truncate">
                        {f.label}
                      </dt>
                      <dd className="font-mono text-xs whitespace-pre-wrap break-words">
                        <ResponseValue field={f} value={v} />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
