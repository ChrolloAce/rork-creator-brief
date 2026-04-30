"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { VideoExample } from "@/lib/types";
import { allVideos } from "@/lib/all-videos";
import { formats as formatsMeta } from "@/lib/formats";
import type { BriefOverview, BriefHookCategory } from "@/lib/db";
import { HooksEditor } from "@/components/admin/HooksEditor";
import { LogoUpload } from "@/components/admin/LogoUpload";
import { OverviewEditor } from "@/components/admin/OverviewEditor";
import { ProjectSources } from "@/components/admin/ProjectSources";
import { VideoChip } from "@/components/admin/VideoChip";
import { VideoPicker } from "@/components/admin/VideoPicker";

type FormatOverride = {
  title?: string;
  tagline?: string;
  description?: string;
  structure?: string[];
  tips?: string[];
  bestFor?: string[];
};

type Curation = {
  exclude: string[];
  formatPins: Record<string, string[]>;
  formatBuckets: Record<string, string | null>;
  formatOverrides?: Record<string, FormatOverride>;
  formatOrder?: string[];
  scopedProjectIds?: string[];
  videoMetadata?: Record<string, VideoExample>;
};

type Preview = Record<
  string,
  { pinnedVideos: VideoExample[]; autoVideos: VideoExample[] }
>;

type BriefRecord = {
  slug: string;
  name: string;
  logoUrl: string | null;
  overview?: BriefOverview | null;
  hookCategories?: BriefHookCategory[] | null;
};

export function BriefEditor({ briefSlug }: { briefSlug: string }) {
  const [brief, setBrief] = useState<BriefRecord | null>(null);
  const [cur, setCur] = useState<Curation | null>(null);
  const [preview, setPreview] = useState<Preview>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function load() {
    const [r1, r2] = await Promise.all([
      fetch(`/api/curation?brief=${encodeURIComponent(briefSlug)}`, {
        cache: "no-store",
      }),
      fetch(`/api/briefs/${encodeURIComponent(briefSlug)}`, {
        cache: "no-store",
      }),
    ]);
    const j1 = await r1.json();
    const j2 = await r2.json();
    if (j1.ok) {
      setCur(j1.curation);
      setPreview(j1.preview ?? {});
    } else {
      setLoadError(j1.error ?? "failed to load");
    }
    if (j2.ok) setBrief(j2.brief);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefSlug]);

  async function persist(next: Curation) {
    setSaving(true);
    const res = await fetch(
      `/api/curation?brief=${encodeURIComponent(briefSlug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curation: next }),
      }
    );
    const j = await res.json();
    setSaving(false);
    if (res.ok) {
      setSaveMsg(`Saved ✓  ${new Date(j.savedAt).toLocaleTimeString()}`);
      setTimeout(() => setSaveMsg(null), 2500);
    } else {
      setSaveMsg(`ERR: ${j.error ?? res.status}`);
    }
  }

  async function saveBrief(patch: Partial<BriefRecord>) {
    setSaving(true);
    const res = await fetch(
      `/api/briefs/${encodeURIComponent(briefSlug)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    const j = await res.json();
    setSaving(false);
    if (res.ok) {
      setBrief(j.brief);
      if (j.brief.slug !== briefSlug) {
        // slug changed — redirect to new editor URL
        window.location.href = `/admin/b/${j.brief.slug}`;
        return;
      }
      setSaveMsg(`Brief saved ✓`);
      setTimeout(() => setSaveMsg(null), 2500);
    } else {
      setSaveMsg(`ERR: ${j.error ?? res.status}`);
    }
  }

  async function onSaveAll() {
    if (!cur) return;
    await persist(cur);
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
  if (!cur || !brief) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const slugs = formatsMeta.map((f) => f.slug);
  const allExcluded = new Set<string>(cur.exclude);
  for (const slug of slugs) {
    for (const id of cur.formatPins[slug] ?? []) allExcluded.add(id);
  }

  // Effective ordering + which formats are hidden on this brief
  const effectiveOrder: string[] =
    cur.formatOrder && cur.formatOrder.length > 0
      ? cur.formatOrder.filter((s) => slugs.includes(s))
      : slugs;
  const hiddenSlugs = slugs.filter((s) => !effectiveOrder.includes(s));

  function applyOrder(nextOrder: string[]) {
    if (!cur) return;
    const nextCur: Curation = { ...cur, formatOrder: nextOrder };
    setCur(nextCur);
    void persist(nextCur);
  }

  function moveFormat(slug: string, dir: -1 | 1) {
    const idx = effectiveOrder.indexOf(slug);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= effectiveOrder.length) return;
    const next = [...effectiveOrder];
    [next[idx], next[target]] = [next[target], next[idx]];
    applyOrder(next);
  }

  function hideFormat(slug: string) {
    applyOrder(effectiveOrder.filter((s) => s !== slug));
  }

  function showFormat(slug: string) {
    applyOrder([...effectiveOrder, slug]);
  }

  return (
    <main className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-20 bg-background border-b-2 border-line">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3 flex-wrap">
          <Link
            href="/admin"
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            ← Briefs
          </Link>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Editing · {brief.slug}
            </div>
            <h1 className="text-xl font-black">{brief.name}</h1>
          </div>
          <a
            href={`/b/${brief.slug}`}
            target="_blank"
            rel="noreferrer"
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            Preview ↗
          </a>
          <button
            onClick={onSaveAll}
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
        <BriefSettings brief={brief} onSave={saveBrief} />

        <OverviewEditor
          value={brief.overview}
          onSave={async (overview) => {
            await saveBrief({ overview });
          }}
        />

        <HooksEditor
          value={brief.hookCategories}
          onSave={async (hookCategories) => {
            await saveBrief({ hookCategories });
          }}
        />

        <ProjectSources
          value={cur.scopedProjectIds ?? []}
          onChange={(next) => {
            if (!cur) return;
            const nextCur: Curation = { ...cur, scopedProjectIds: next };
            setCur(nextCur);
            void persist(nextCur);
          }}
        />

        {effectiveOrder.map((slug, idx) => {
          const meta = formatsMeta.find((f) => f.slug === slug);
          if (!meta) return null;
          return (
          <FormatSection
            key={meta.slug}
            slug={meta.slug}
            defaultTitle={meta.title}
            defaultTagline={meta.tagline}
            defaultDescription={meta.description}
            defaultStructure={meta.structure}
            defaultTips={meta.tips}
            defaultBestFor={meta.bestFor}
            pins={cur.formatPins[meta.slug] ?? []}
            override={cur.formatOverrides?.[meta.slug] ?? {}}
            pinnedVideos={preview[meta.slug]?.pinnedVideos ?? []}
            allExcluded={allExcluded}
            scopedProjectIds={cur.scopedProjectIds}
            canMoveUp={idx > 0}
            canMoveDown={idx < effectiveOrder.length - 1}
            onMoveUp={() => moveFormat(meta.slug, -1)}
            onMoveDown={() => moveFormat(meta.slug, 1)}
            onHide={() => hideFormat(meta.slug)}
            onPickVideo={(v) => {
              if (!cur || !v.dbId) return;
              const existingPins = cur.formatPins[meta.slug] ?? [];
              if (existingPins.includes(v.dbId)) return;
              const nextPins = [...existingPins, v.dbId];
              const inStaticPool = allVideos.some((x) => x.dbId === v.dbId);
              const nextCur: Curation = {
                ...cur,
                formatPins: {
                  ...cur.formatPins,
                  [meta.slug]: nextPins,
                },
                videoMetadata: inStaticPool
                  ? cur.videoMetadata
                  : { ...(cur.videoMetadata ?? {}), [v.dbId]: v },
              };
              setCur(nextCur);
              // optimistic: add to preview
              setPreview((p) => {
                const c = p[meta.slug] ?? { pinnedVideos: [], autoVideos: [] };
                return {
                  ...p,
                  [meta.slug]: {
                    ...c,
                    pinnedVideos: [...c.pinnedVideos, v],
                  },
                };
              });
              void persist(nextCur);
            }}
            onChangePins={(nextPins) => {
              if (!cur) return;
              const nextCur: Curation = {
                ...cur,
                formatPins: {
                  ...cur.formatPins,
                  [meta.slug]: nextPins,
                },
              };
              setCur(nextCur);
              setPreview((p) => {
                const c = p[meta.slug];
                if (!c) return p;
                return {
                  ...p,
                  [meta.slug]: {
                    ...c,
                    pinnedVideos: c.pinnedVideos.filter(
                      (v) => v.dbId && nextPins.includes(v.dbId)
                    ),
                  },
                };
              });
              void persist(nextCur);
            }}
            onChangeOverride={(next) =>
              setCur((c) =>
                c
                  ? {
                      ...c,
                      formatOverrides: {
                        ...(c.formatOverrides ?? {}),
                        [meta.slug]: next,
                      },
                    }
                  : c
              )
            }
          />
          );
        })}

        {hiddenSlugs.length > 0 && (
          <section className="border-2 border-line bg-paper rounded-md p-4 sm:p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
              Hidden formats ({hiddenSlugs.length})
            </div>
            <p className="text-xs text-muted mb-3">
              Not shown on this brief. Tap to bring a section back.
            </p>
            <div className="flex flex-wrap gap-2">
              {hiddenSlugs.map((slug) => {
                const meta = formatsMeta.find((f) => f.slug === slug);
                if (!meta) return null;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => showFormat(slug)}
                    className="border-2 border-line bg-background px-3 py-1.5 rounded-md nb-press text-xs font-bold"
                  >
                    + {meta.title}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <ExcludeSection
          excluded={cur.exclude}
          pickerExcluded={allExcluded}
          scopedProjectIds={cur.scopedProjectIds}
          onChange={(next) => {
            if (!cur) return;
            const nextCur: Curation = { ...cur, exclude: next };
            setCur(nextCur);
            void persist(nextCur);
          }}
        />

        <details className="border-2 border-line rounded-md bg-paper p-3">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Raw JSON (advanced)
          </summary>
          <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap break-all">
            {JSON.stringify(cur, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}

function BriefSettings({
  brief,
  onSave,
}: {
  brief: BriefRecord;
  onSave: (patch: Partial<BriefRecord>) => Promise<void>;
}) {
  const [name, setName] = useState(brief.name);
  const [slug, setSlug] = useState(brief.slug);
  const [logoUrl, setLogoUrl] = useState(brief.logoUrl ?? "");

  useEffect(() => {
    setName(brief.name);
    setSlug(brief.slug);
    setLogoUrl(brief.logoUrl ?? "");
  }, [brief]);

  const dirty =
    name !== brief.name ||
    slug !== brief.slug ||
    (logoUrl || null) !== (brief.logoUrl || null);

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
        Brief settings
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-black focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Slug (URL)
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <div className="block sm:col-span-3">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Logo
          </span>
          <div className="mt-1">
            <LogoUpload
              value={logoUrl || null}
              onChange={(v) => setLogoUrl(v ?? "")}
            />
          </div>
        </div>
      </div>
      {dirty && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() =>
              onSave({ name, slug, logoUrl: logoUrl.trim() || null })
            }
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs"
          >
            Save brief settings
          </button>
        </div>
      )}
    </section>
  );
}

function ListEditor({
  label,
  items,
  defaults,
  itemLabel,
  placeholder,
  rows = 2,
  numbered = false,
  onChange,
}: {
  label: string;
  items?: string[];
  defaults: string[];
  itemLabel: string;
  placeholder?: string;
  rows?: number;
  numbered?: boolean;
  onChange: (next: string[] | undefined) => void;
}) {
  const effective = items ?? defaults;
  const update = (next: string[]) => {
    onChange(next.length === 0 ? undefined : next);
  };
  return (
    <details className="mt-1">
      <summary className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted cursor-pointer">
        {label} ({effective.length})
      </summary>
      <div className="mt-2 space-y-2">
        {effective.map((s, i) => (
          <div key={i} className="flex gap-2 items-start">
            {numbered && (
              <span className="shrink-0 w-7 h-7 border-2 border-line bg-paper flex items-center justify-center font-mono text-xs font-bold rounded-sm mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
            )}
            <textarea
              value={s}
              onChange={(e) => {
                const next = [...effective];
                next[i] = e.target.value;
                update(next);
              }}
              rows={rows}
              placeholder={placeholder}
              className="flex-1 border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                aria-label="Move up"
                title="Move up"
                disabled={i === 0}
                onClick={() => {
                  const next = [...effective];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  update(next);
                }}
                className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                title="Move down"
                disabled={i === effective.length - 1}
                onClick={() => {
                  const next = [...effective];
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  update(next);
                }}
                className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Remove"
                title="Remove"
                onClick={() => update(effective.filter((_, j) => j !== i))}
                className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update([...effective, ""])}
          className="w-full border-2 border-dashed border-line bg-background rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
        >
          + Add {itemLabel}
        </button>
      </div>
    </details>
  );
}

function FormatSection({
  slug,
  defaultTitle,
  defaultTagline,
  defaultDescription,
  defaultStructure,
  defaultTips,
  defaultBestFor,
  pins,
  override,
  pinnedVideos,
  allExcluded,
  scopedProjectIds,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onHide,
  onChangePins,
  onPickVideo,
  onChangeOverride,
}: {
  slug: string;
  defaultTitle: string;
  defaultTagline: string;
  defaultDescription: string;
  defaultStructure: string[];
  defaultTips: string[];
  defaultBestFor: string[];
  pins: string[];
  override: FormatOverride;
  pinnedVideos: VideoExample[];
  allExcluded: Set<string>;
  scopedProjectIds?: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
  onChangePins: (next: string[]) => void;
  onPickVideo: (v: VideoExample) => void;
  onChangeOverride: (next: FormatOverride) => void;
}) {
  const effectiveTitle = (override.title ?? defaultTitle) || defaultTitle;

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="font-mono text-[11px] text-muted border-2 border-line bg-paper px-1.5 py-0.5 rounded-sm">
            {slug}
          </code>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            {pins.length} {pins.length === 1 ? "video" : "videos"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move up"
            title="Move up"
            className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move down"
            title="Move down"
            className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Hide "${effectiveTitle}" from this brief?`)) onHide();
            }}
            aria-label="Hide section"
            title="Hide section"
            className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press"
          >
            ×
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Title
          </span>
          <input
            type="text"
            value={override.title ?? defaultTitle}
            onChange={(e) =>
              onChangeOverride({ ...override, title: e.target.value })
            }
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-lg font-black focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Tagline
          </span>
          <input
            type="text"
            value={override.tagline ?? defaultTagline}
            onChange={(e) =>
              onChangeOverride({ ...override, tagline: e.target.value })
            }
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <details className="mt-1">
          <summary className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted cursor-pointer">
            Description
          </summary>
          <textarea
            value={override.description ?? defaultDescription}
            onChange={(e) =>
              onChangeOverride({ ...override, description: e.target.value })
            }
            rows={5}
            className="mt-2 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </details>
        <ListEditor
          label="Best For"
          items={override.bestFor}
          defaults={defaultBestFor}
          itemLabel="audience"
          rows={2}
          placeholder="Audience this format works for"
          onChange={(next) =>
            onChangeOverride({ ...override, bestFor: next })
          }
        />
        <ListEditor
          label="Shot-by-shot structure"
          items={override.structure}
          defaults={defaultStructure}
          itemLabel="segment"
          rows={2}
          placeholder="0–2s: Hook. ..."
          numbered
          onChange={(next) =>
            onChangeOverride({ ...override, structure: next })
          }
        />
        <ListEditor
          label="Tips"
          items={override.tips}
          defaults={defaultTips}
          itemLabel="tip"
          rows={2}
          placeholder="Record the hook 5–10 times..."
          onChange={(next) =>
            onChangeOverride({ ...override, tips: next })
          }
        />
        {(override.title ||
          override.tagline ||
          override.description ||
          override.structure ||
          override.tips ||
          override.bestFor) && (
          <button
            type="button"
            onClick={() => onChangeOverride({})}
            className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent underline"
          >
            Reset to default
          </button>
        )}
      </div>

      <h3 className="text-base font-black">{effectiveTitle}</h3>
      <p className="text-xs text-muted mb-3">
        {pinnedVideos.length > 0
          ? `Showing ${pinnedVideos.length} ${pinnedVideos.length === 1 ? "video" : "videos"} to viewers.`
          : "No videos yet — add them below."}
      </p>

      {pinnedVideos.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
          {pinnedVideos.map((v) => (
            <VideoChip
              key={v.dbId}
              video={v}
              fallbackId={v.dbId}
              onRemove={() => {
                if (v.dbId) onChangePins(pins.filter((x) => x !== v.dbId));
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted mb-3 italic">
          Empty. Use the picker below.
        </p>
      )}

      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
        Add a video
      </div>
      <VideoPicker
        excludedIds={allExcluded}
        scopedProjectIds={scopedProjectIds}
        onPick={onPickVideo}
        placeholder="Search @creator or caption…"
      />
    </section>
  );
}

function ExcludeSection({
  excluded,
  pickerExcluded,
  scopedProjectIds,
  onChange,
}: {
  excluded: string[];
  pickerExcluded: Set<string>;
  scopedProjectIds?: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        Excluded globally ({excluded.length})
      </div>
      <p className="text-xs text-muted mb-3">
        Videos here are removed from every format on this brief.
      </p>
      {excluded.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {excluded.map((id) => (
            <li
              key={id}
              className="flex items-center gap-2 border-2 border-line bg-paper rounded-sm px-2 py-1"
            >
              <span className="font-mono text-[11px] text-ink-soft flex-1 truncate">
                {id}
              </span>
              <button
                type="button"
                onClick={() => onChange(excluded.filter((x) => x !== id))}
                className="text-xs font-black border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
        Exclude a video manually
      </div>
      <VideoPicker
        excludedIds={pickerExcluded}
        scopedProjectIds={scopedProjectIds}
        onPick={(v) => {
          if (v.dbId && !excluded.includes(v.dbId))
            onChange([...excluded, v.dbId]);
        }}
        placeholder="Search @creator or caption…"
      />
    </section>
  );
}
