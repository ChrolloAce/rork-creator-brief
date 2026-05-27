"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HookCategory, VideoExample } from "@/lib/types";
import {
  SECTION_STAT_KEYS,
  SECTION_STAT_LABELS,
  SECTION_STAT_DEFAULTS,
  computeSectionStat,
  sanitizeVisibleStats,
  type SectionStatKey,
} from "@/lib/section-stats";
import { allVideos } from "@/lib/all-videos";
import { formats as formatsMeta } from "@/lib/formats";
import { hookCategories as defaultHookCategories } from "@/lib/hooks";
import type { BriefOverview, BriefHookCategory } from "@/lib/db";
import { CollapsibleCard } from "@/components/admin/CollapsibleCard";
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
  script?: string;
  structure?: { text: string; image?: string; hidden?: boolean }[];
  tips?: { text: string; image?: string; hidden?: boolean }[];
  bestFor?: { text: string; image?: string; hidden?: boolean }[];
  hiddenSections?: string[];
};

type Curation = {
  exclude: string[];
  formatPins: Record<string, string[]>;
  formatBuckets: Record<string, string | null>;
  formatOverrides?: Record<string, FormatOverride>;
  formatOrder?: string[];
  scopedProjectIds?: string[];
  videoMetadata?: Record<string, VideoExample>;
  formatClones?: Record<string, string>;
  publicStats?: { enabled: boolean; visible?: string[] };
  hideOverview?: boolean;
  hiddenFormats?: string[];
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

function SectionStats({
  videos,
  visible,
  publicEnabled,
  onChange,
}: {
  videos: VideoExample[];
  visible: SectionStatKey[];
  publicEnabled: boolean;
  onChange: (patch: { visible?: SectionStatKey[]; publicEnabled?: boolean }) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const visibleSet = new Set(visible);

  function toggleStat(k: SectionStatKey) {
    const next = visible.includes(k)
      ? visible.filter((x) => x !== k)
      : [...visible, k];
    onChange({ visible: next });
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-1.5 items-stretch">
        {visible.map((k) => (
          <div
            key={k}
            className="border-2 border-line bg-paper px-2 py-1 rounded-sm min-w-[64px]"
          >
            <div className="text-sm font-black leading-none">
              {computeSectionStat(k, videos)}
            </div>
            <div className="text-[9px] uppercase tracking-widest font-bold text-muted mt-1 leading-none">
              {SECTION_STAT_LABELS[k]}
            </div>
          </div>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            title="Toggle which stats are shown"
            className="h-full border-2 border-line bg-background px-2 py-1 rounded-sm font-black nb-press text-xs"
          >
            ⚙
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 border-2 border-line bg-background rounded-md nb-shadow-sm min-w-[220px]">
              <div className="px-3 py-2 text-[9px] uppercase tracking-[0.2em] font-bold text-muted border-b-2 border-line">
                Show stats
              </div>
              {SECTION_STAT_KEYS.map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold hover:bg-paper cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleSet.has(k)}
                    onChange={() => toggleStat(k)}
                  />
                  <span>{SECTION_STAT_LABELS[k]}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-paper cursor-pointer border-t-2 border-line bg-paper/50">
                <input
                  type="checkbox"
                  checked={publicEnabled}
                  onChange={() =>
                    onChange({ publicEnabled: !publicEnabled })
                  }
                />
                <span>Show on public preview</span>
              </label>
              <div className="px-3 py-1.5 border-t-2 border-line">
                <button
                  type="button"
                  onClick={() =>
                    onChange({ visible: SECTION_STAT_DEFAULTS })
                  }
                  className="w-full text-[10px] uppercase tracking-widest font-bold text-muted hover:text-ink"
                >
                  Reset stats to defaults
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BriefEditor({ briefSlug }: { briefSlug: string }) {
  const [brief, setBrief] = useState<BriefRecord | null>(null);
  const [cur, setCur] = useState<Curation | null>(null);
  const [preview, setPreview] = useState<Preview>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [allBriefs, setAllBriefs] = useState<
    Array<{ slug: string; name: string }>
  >([]);

  async function load() {
    const [r1, r2, r3] = await Promise.all([
      fetch(`/api/curation?brief=${encodeURIComponent(briefSlug)}`, {
        cache: "no-store",
      }),
      fetch(`/api/briefs/${encodeURIComponent(briefSlug)}`, {
        cache: "no-store",
      }),
      fetch(`/api/briefs`, { cache: "no-store" }),
    ]);
    const j1 = await r1.json();
    const j2 = await r2.json();
    const j3 = await r3.json();
    if (j1.ok) {
      setCur(j1.curation);
      setPreview(j1.preview ?? {});
    } else {
      setLoadError(j1.error ?? "failed to load");
    }
    if (j2.ok) setBrief(j2.brief);
    if (j3.ok && Array.isArray(j3.briefs)) {
      setAllBriefs(
        j3.briefs.map((b: { slug: string; name: string }) => ({
          slug: b.slug,
          name: b.name,
        }))
      );
    }
  }

  async function copySectionToBrief(
    targetSlug: string,
    formatSlug: string
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(
      `/api/briefs/${encodeURIComponent(briefSlug)}/copy-format`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSlug, formatSlug }),
      }
    );
    const j = await res.json();
    if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
    return { ok: true };
  }

  async function cloneSectionInBrief(
    formatSlug: string
  ): Promise<{ ok: boolean; error?: string; newSlug?: string }> {
    const res = await fetch(
      `/api/briefs/${encodeURIComponent(briefSlug)}/clone-section`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatSlug }),
      }
    );
    const j = await res.json();
    if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
    await load(); // refresh state so the new clone shows up
    return { ok: true, newSlug: j.newSlug };
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefSlug]);

  async function persist(next: Curation) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/curation?brief=${encodeURIComponent(briefSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ curation: next }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveMsg(`Saved ✓  ${new Date(j.savedAt).toLocaleTimeString()}`);
        setTimeout(() => setSaveMsg(null), 2500);
      } else {
        setSaveMsg(`SAVE FAILED: ${j.error ?? `HTTP ${res.status}`}`);
        // Don't auto-dismiss errors — user needs to see them.
      }
    } catch (e) {
      setSaveMsg(`SAVE FAILED: ${(e as Error).message}`);
    } finally {
      setSaving(false);
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

  const hookSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setAndSaveHooks(next: BriefHookCategory[] | null) {
    setBrief((b) => (b ? { ...b, hookCategories: next } : b));
    if (hookSaveTimer.current) clearTimeout(hookSaveTimer.current);
    hookSaveTimer.current = setTimeout(() => {
      void saveBrief({ hookCategories: next });
    }, 600);
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

  const baseSlugs = formatsMeta.map((f) => f.slug);
  const cloneSlugs = Object.keys(cur.formatClones ?? {});
  const allSlugs = [...baseSlugs, ...cloneSlugs];

  // Resolve a (base OR clone) slug to its meta source.
  function metaFor(slug: string) {
    const direct = formatsMeta.find((f) => f.slug === slug);
    if (direct) return direct;
    const cloneSource = cur?.formatClones?.[slug];
    if (!cloneSource) return undefined;
    return formatsMeta.find((f) => f.slug === cloneSource);
  }

  // Public preview stats config (server-backed via curation). Defaults
  // applied if the brief hasn't been configured yet.
  const publicStatsVisible = sanitizeVisibleStats(
    cur.publicStats?.visible ?? SECTION_STAT_DEFAULTS
  );
  const publicStatsEnabled = !!cur.publicStats?.enabled;

  function updatePublicStats(patch: {
    visible?: SectionStatKey[];
    publicEnabled?: boolean;
  }) {
    if (!cur) return;
    const nextStats = {
      enabled:
        patch.publicEnabled !== undefined
          ? patch.publicEnabled
          : publicStatsEnabled,
      visible:
        patch.visible !== undefined ? patch.visible : publicStatsVisible,
    };
    const nextCur: Curation = { ...cur, publicStats: nextStats };
    setCur(nextCur);
    void persist(nextCur);
  }

  // Global exclude set — videos manually excluded brand-wide.
  const globalExcluded = new Set<string>(cur.exclude);
  // Wider "in use somewhere" set — only used by the ExcludeSection picker so
  // it doesn't suggest re-excluding already-handled videos. Per-section
  // pickers use a narrower set built inline below.
  const allInUse = new Set<string>(cur.exclude);
  for (const slug of allSlugs) {
    for (const id of cur.formatPins[slug] ?? []) allInUse.add(id);
  }

  // Order all formats (visible + hidden). formatOrder is order-only; hidden
  // is tracked separately so hidden formats stay in the admin list and only
  // disappear from the public brief.
  const orderSource =
    cur.formatOrder && cur.formatOrder.length > 0 ? cur.formatOrder : allSlugs;
  const effectiveOrder: string[] = [
    ...orderSource.filter((s) => allSlugs.includes(s)),
    ...allSlugs.filter((s) => !orderSource.includes(s)),
  ];
  // Legacy: slugs missing from a non-empty formatOrder were hidden under the
  // old "remove from order to hide" model. Treat them as hidden until the
  // brief re-saves with the new schema.
  const legacyHidden =
    cur.formatOrder && cur.formatOrder.length > 0
      ? allSlugs.filter((s) => !cur.formatOrder!.includes(s))
      : [];
  const hiddenSet = new Set<string>([
    ...(cur.hiddenFormats ?? []),
    ...legacyHidden,
  ]);

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

  function toggleFormatHidden(slug: string) {
    if (!cur) return;
    const merged = new Set<string>([
      ...(cur.hiddenFormats ?? []),
      ...legacyHidden,
    ]);
    if (merged.has(slug)) merged.delete(slug);
    else merged.add(slug);
    // Migrate to the new schema: persist the merged hidden set + the full
    // order, so legacyHidden becomes a no-op on subsequent reads.
    const nextCur: Curation = {
      ...cur,
      hiddenFormats: [...merged],
      formatOrder: effectiveOrder,
    };
    setCur(nextCur);
    void persist(nextCur);
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
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press inline-flex items-center gap-1.5"
          >
            Save
            {saving && (
              <span
                aria-label="Saving"
                className="inline-block w-2 h-2 rounded-full bg-background animate-pulse"
              />
            )}
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
            <div
              className={`flex items-center justify-between gap-2 text-xs font-bold border-2 border-line px-2 py-1.5 rounded-sm ${
                saveMsg.startsWith("SAVE FAILED")
                  ? "bg-[#fee2e2] text-[#7f1d1d]"
                  : "bg-paper"
              }`}
            >
              <span>{saveMsg}</span>
              <button
                type="button"
                onClick={() => setSaveMsg(null)}
                aria-label="Dismiss"
                className="font-black px-1.5"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted">
          Settings
        </div>
        <CollapsibleCard
          storageKey={`brief-editor:${briefSlug}:brief-settings`}
          title="Brief settings"
        >
          <BriefSettings brief={brief} onSave={saveBrief} />
        </CollapsibleCard>

        <CollapsibleCard
          storageKey={`brief-editor:${briefSlug}:overview`}
          title="Overview page content"
          meta={cur.hideOverview ? "Hidden" : undefined}
        >
          <label className="flex items-center gap-2 mb-4 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={!!cur.hideOverview}
              onChange={(e) => {
                const next: Curation = { ...cur, hideOverview: e.target.checked };
                setCur(next);
                void persist(next);
              }}
            />
            <span>Hide overview page (visitors jump straight to the first format)</span>
          </label>
          <OverviewEditor
            value={brief.overview}
            onSave={async (overview) => {
              await saveBrief({ overview });
            }}
          />
        </CollapsibleCard>

        <CollapsibleCard
          storageKey={`brief-editor:${briefSlug}:hooks`}
          title="Hook library"
        >
          <HooksEditor
            value={brief.hookCategories}
            onSave={async (hookCategories) => {
              await saveBrief({ hookCategories });
            }}
          />
        </CollapsibleCard>

        <CollapsibleCard
          storageKey={`brief-editor:${briefSlug}:sources`}
          title="ViewTrack sources"
          meta={`${(cur.scopedProjectIds ?? []).length} selected`}
        >
          <ProjectSources
            value={cur.scopedProjectIds ?? []}
            onChange={(next) => {
              if (!cur) return;
              const nextCur: Curation = { ...cur, scopedProjectIds: next };
              setCur(nextCur);
              void persist(nextCur);
            }}
          />
        </CollapsibleCard>

        <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted pt-2">
          Sections
        </div>
        {effectiveOrder.map((slug, idx) => {
          const meta = metaFor(slug);
          if (!meta) return null;
          const override = cur.formatOverrides?.[slug] ?? {};
          const effectiveTitle = override.title ?? meta.title;
          const pinCount = (cur.formatPins[slug] ?? []).length;
          const isClone = !!cur.formatClones?.[slug];
          const isHidden = hiddenSet.has(slug);
          return (
          <div key={slug} className={isHidden ? "opacity-50" : undefined}>
          <CollapsibleCard
            storageKey={`brief-editor:${briefSlug}:format:${slug}`}
            title={effectiveTitle}
            meta={`${isHidden ? "HIDDEN · " : ""}${isClone ? "COPY · " : ""}${pinCount} ${pinCount === 1 ? "video" : "videos"}`}
            action={
              <button
                type="button"
                onClick={() => toggleFormatHidden(slug)}
                aria-label={isHidden ? "Show on public brief" : "Hide from public brief"}
                title={
                  isHidden
                    ? "Hidden from public brief — click to publish"
                    : "Hide from public brief (still editable here)"
                }
                className={`w-8 h-8 border-2 border-line rounded-sm font-black nb-press flex items-center justify-center shrink-0 ${isHidden ? "bg-paper text-muted" : "bg-background"}`}
              >
                <EyeIcon off={isHidden} />
              </button>
            }
          >
          <FormatSection
            slug={slug}
            briefName={brief.name}
            availableBriefs={allBriefs.filter((b) => b.slug !== briefSlug)}
            onCopyToBrief={(targetSlug) =>
              copySectionToBrief(targetSlug, slug)
            }
            onCloneInBrief={() => cloneSectionInBrief(slug)}
            publicStatsVisible={publicStatsVisible}
            publicStatsEnabled={publicStatsEnabled}
            onPublicStatsChange={updatePublicStats}
            defaultTitle={meta.title}
            defaultTagline={meta.tagline}
            defaultDescription={meta.description}
            defaultStructure={meta.structure.map((i) =>
              typeof i === "string" ? i : i.text
            )}
            defaultTips={meta.tips.map((i) =>
              typeof i === "string" ? i : i.text
            )}
            defaultBestFor={meta.bestFor.map((i) =>
              typeof i === "string" ? i : i.text
            )}
            linkedHookSlugs={meta.hookCategorySlugs}
            defaultHookCategories={defaultHookCategories.filter((c) =>
              meta.hookCategorySlugs.includes(c.slug)
            )}
            hookCategories={brief.hookCategories ?? null}
            onChangeHookCategories={setAndSaveHooks}
            pins={cur.formatPins[slug] ?? []}
            override={cur.formatOverrides?.[slug] ?? {}}
            pinnedVideos={preview[slug]?.pinnedVideos ?? []}
            globalExcluded={globalExcluded}
            scopedProjectIds={cur.scopedProjectIds}
            canMoveUp={idx > 0}
            canMoveDown={idx < effectiveOrder.length - 1}
            onMoveUp={() => moveFormat(slug, -1)}
            onMoveDown={() => moveFormat(slug, 1)}
            onPickVideo={(v) => {
              if (!cur || !v.dbId) return;
              const existingPins = cur.formatPins[slug] ?? [];
              if (existingPins.includes(v.dbId)) return;
              const nextPins = [...existingPins, v.dbId];
              const inStaticPool = allVideos.some((x) => x.dbId === v.dbId);
              const nextCur: Curation = {
                ...cur,
                formatPins: {
                  ...cur.formatPins,
                  [slug]: nextPins,
                },
                videoMetadata: inStaticPool
                  ? cur.videoMetadata
                  : { ...(cur.videoMetadata ?? {}), [v.dbId]: v },
              };
              setCur(nextCur);
              setPreview((p) => {
                const c = p[slug] ?? { pinnedVideos: [], autoVideos: [] };
                return {
                  ...p,
                  [slug]: {
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
                  [slug]: nextPins,
                },
              };
              setCur(nextCur);
              setPreview((p) => {
                const c = p[slug];
                if (!c) return p;
                return {
                  ...p,
                  [slug]: {
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
                        [slug]: next,
                      },
                    }
                  : c
              )
            }
          />
          </CollapsibleCard>
          </div>
          );
        })}

        <CollapsibleCard
          storageKey={`brief-editor:${briefSlug}:excluded`}
          title="Excluded globally"
          meta={`${cur.exclude.length} excluded`}
        >
          <ExcludeSection
            excluded={cur.exclude}
            pickerExcluded={allInUse}
            scopedProjectIds={cur.scopedProjectIds}
            onChange={(next) => {
              if (!cur) return;
              const nextCur: Curation = { ...cur, exclude: next };
              setCur(nextCur);
              void persist(nextCur);
            }}
          />
        </CollapsibleCard>

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
    <div>
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
    </div>
  );
}

// Resize an image file to a max dimension and return as a data URL.
// Reused for inline list-item images. Larger than the logo upload since these
// are visual references for shots/tips, not icons.
const ITEM_IMG_MAX_DIM = 800;
const ITEM_IMG_MAX_RAW_BYTES = 8 * 1024 * 1024;
async function resizeImage(file: File): Promise<string> {
  if (file.size > ITEM_IMG_MAX_RAW_BYTES) {
    throw new Error("File is >8MB — use a smaller source.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    ITEM_IMG_MAX_DIM / Math.max(bitmap.width, bitmap.height)
  );
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = mime === "image/jpeg" ? 0.85 : undefined;
  return canvas.toDataURL(mime, quality);
}

type RowItem = { text: string; image?: string; hidden?: boolean };

function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ItemImagePicker({
  image,
  onChange,
}: {
  image?: string;
  onChange: (next: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const url = await resizeImage(f);
            onChange(url);
          } catch (err) {
            alert((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {image ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            onClick={() => inputRef.current?.click()}
            className="w-28 max-h-40 object-contain border-2 border-line rounded-sm bg-paper cursor-pointer"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Remove image"
            className="absolute -top-1 -right-1 w-5 h-5 bg-background border-2 border-line rounded-full text-[11px] font-black leading-none flex items-center justify-center"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title="Add image"
          className="w-28 h-20 border-2 border-dashed border-line bg-paper rounded-sm text-[10px] font-black text-muted hover:text-accent hover:border-accent disabled:opacity-40"
        >
          {busy ? "…" : "+ IMAGE"}
        </button>
      )}
    </div>
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
  hidden = false,
  onToggleHidden,
  onChange,
}: {
  label: string;
  items?: RowItem[];
  defaults: string[];
  itemLabel: string;
  placeholder?: string;
  rows?: number;
  numbered?: boolean;
  hidden?: boolean;
  onToggleHidden?: () => void;
  onChange: (next: RowItem[] | undefined) => void;
}) {
  const effective: RowItem[] =
    items ?? defaults.map((s) => ({ text: s }));
  const update = (next: RowItem[]) => {
    onChange(next.length === 0 ? undefined : next);
  };
  return (
    <div className={hidden ? "opacity-60" : undefined}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          {label} ({effective.length})
          {hidden && (
            <span className="ml-2 px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px]">
              HIDDEN
            </span>
          )}
        </div>
        {onToggleHidden && (
          <button
            type="button"
            onClick={onToggleHidden}
            className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {hidden ? "Show" : "Hide section"}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {effective.map((row, i) => (
          <div
            key={i}
            className={`flex gap-2 items-start ${row.hidden ? "opacity-50" : ""}`}
          >
            {numbered && (
              <span className="shrink-0 w-7 h-7 border-2 border-line bg-paper flex items-center justify-center font-mono text-xs font-bold rounded-sm mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
            )}
            <ItemImagePicker
              image={row.image}
              onChange={(image) => {
                const next = [...effective];
                next[i] = { ...next[i], image };
                update(next);
              }}
            />
            <textarea
              value={row.text}
              onChange={(e) => {
                const next = [...effective];
                next[i] = { ...next[i], text: e.target.value };
                update(next);
              }}
              rows={rows}
              placeholder={placeholder}
              className="flex-1 border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                aria-label={row.hidden ? "Show on public page" : "Hide from public page"}
                title={row.hidden ? "Hidden — click to show" : "Visible — click to hide"}
                onClick={() => {
                  const next = [...effective];
                  next[i] = { ...next[i], hidden: !next[i].hidden };
                  update(next);
                }}
                className={`w-7 h-7 border-2 border-line rounded-sm font-black nb-press flex items-center justify-center ${row.hidden ? "bg-paper text-muted" : "bg-background"}`}
              >
                <EyeIcon off={row.hidden} />
              </button>
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
          onClick={() => update([...effective, { text: "" }])}
          className="w-full border-2 border-dashed border-line bg-background rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
        >
          + Add {itemLabel}
        </button>
      </div>
    </div>
  );
}

function AskClaude({
  briefName,
  formatTitle,
  formatTagline,
  formatDescription,
  structure,
  tips,
  hooks,
  currentScript,
  onApply,
}: {
  briefName: string;
  formatTitle: string;
  formatTagline: string;
  formatDescription: string;
  structure: string[];
  tips: string[];
  hooks: string[];
  currentScript: string;
  onApply: (text: string, mode: "replace" | "append") => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!prompt.trim() || streaming) return;
    setError(null);
    setDraft("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          briefName,
          formatTitle,
          formatTagline,
          formatDescription,
          structure,
          tips,
          hooks,
          currentScript,
          userPrompt: prompt,
        }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        setError(msg || `HTTP ${res.status}`);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setDraft((d) => d + chunk);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
      >
        ✦ Ask Claude
      </button>
    );
  }

  return (
    <div className="mt-3 border-2 border-line bg-paper rounded-md p-3 nb-shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          ✦ Ask Claude · script writer
        </div>
        <button
          type="button"
          onClick={() => {
            cancel();
            setOpen(false);
            setDraft("");
            setError(null);
          }}
          className="text-xs font-bold text-muted hover:text-ink"
        >
          Close
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="e.g. Write a 30s script highlighting the no-code angle, lead with a curiosity hook"
        className="w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void generate();
          }
        }}
      />
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {streaming ? (
          <button
            type="button"
            onClick={cancel}
            className="border-2 border-line bg-background px-3 py-1 rounded-md nb-press text-xs font-black uppercase tracking-widest"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={!prompt.trim()}
            className="border-2 border-line bg-ink text-background px-3 py-1 rounded-md nb-press text-xs font-black uppercase tracking-widest disabled:opacity-40"
          >
            Generate ⌘↵
          </button>
        )}
        {draft && !streaming && (
          <>
            <button
              type="button"
              onClick={() => {
                onApply(draft, "replace");
                setDraft("");
              }}
              className="border-2 border-line bg-accent text-accent-ink px-3 py-1 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              Replace script
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft, "append");
                setDraft("");
              }}
              className="border-2 border-line bg-background px-3 py-1 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              Append
            </button>
            <button
              type="button"
              onClick={() => setDraft("")}
              className="border-2 border-line bg-background px-3 py-1 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              Discard
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs font-bold text-[#b91c1c] border-2 border-line bg-background px-2 py-1 rounded-sm whitespace-pre-wrap">
          {error}
        </p>
      )}
      {(draft || streaming) && (
        <pre className="mt-2 text-xs font-mono whitespace-pre-wrap leading-relaxed border-2 border-line bg-background rounded-md p-2 max-h-[260px] overflow-auto">
          {draft}
          {streaming && <span className="opacity-50">▍</span>}
        </pre>
      )}
    </div>
  );
}

function FormatSection({
  slug,
  briefName,
  availableBriefs,
  onCopyToBrief,
  onCloneInBrief,
  publicStatsVisible,
  publicStatsEnabled,
  onPublicStatsChange,
  defaultTitle,
  defaultTagline,
  defaultDescription,
  defaultStructure,
  defaultTips,
  defaultBestFor,
  linkedHookSlugs,
  defaultHookCategories,
  hookCategories,
  onChangeHookCategories,
  pins,
  override,
  pinnedVideos,
  globalExcluded,
  scopedProjectIds,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onChangePins,
  onPickVideo,
  onChangeOverride,
}: {
  slug: string;
  briefName: string;
  availableBriefs: Array<{ slug: string; name: string }>;
  onCopyToBrief: (targetSlug: string) => Promise<{ ok: boolean; error?: string }>;
  onCloneInBrief: () => Promise<{ ok: boolean; error?: string; newSlug?: string }>;
  publicStatsVisible: SectionStatKey[];
  publicStatsEnabled: boolean;
  onPublicStatsChange: (patch: { visible?: SectionStatKey[]; publicEnabled?: boolean }) => void;
  defaultTitle: string;
  defaultTagline: string;
  defaultDescription: string;
  defaultStructure: string[];
  defaultTips: string[];
  defaultBestFor: string[];
  linkedHookSlugs: string[];
  defaultHookCategories: HookCategory[];
  hookCategories: BriefHookCategory[] | null;
  onChangeHookCategories: (next: BriefHookCategory[] | null) => void;
  pins: string[];
  override: FormatOverride;
  pinnedVideos: VideoExample[];
  globalExcluded: Set<string>;
  scopedProjectIds?: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangePins: (next: string[]) => void;
  onPickVideo: (v: VideoExample) => void;
  onChangeOverride: (next: FormatOverride) => void;
}) {
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);

  // Picker excludes globally-blocked videos + the current section's own pins
  // (to prevent duplicate pin in the same section). Pins in OTHER sections
  // are intentionally allowed — the same video can appear in multiple
  // sections of the same brief.
  const sectionExcluded = new Set<string>(globalExcluded);
  for (const id of pins) sectionExcluded.add(id);

  async function handleCopyTo(targetSlug: string, targetName: string) {
    if (copyBusy) return;
    if (!confirm(
      `Copy this section's pins, overrides, and bucket into "${targetName}"? This will overwrite that brief's existing data for this format.`
    )) {
      return;
    }
    setCopyBusy(true);
    setCopyMsg(null);
    const res = await onCopyToBrief(targetSlug);
    setCopyBusy(false);
    if (res.ok) {
      setCopyMsg(`Copied to ${targetName} ✓`);
      setCopyOpen(false);
      setTimeout(() => setCopyMsg(null), 2500);
    } else {
      setCopyMsg(`Failed: ${res.error}`);
    }
  }
  const effectiveTitle = (override.title ?? defaultTitle) || defaultTitle;

  const isSectionHidden = (key: string) =>
    override.hiddenSections?.includes(key) ?? false;
  const toggleSectionHidden = (key: string) => {
    const cur = override.hiddenSections ?? [];
    const next = cur.includes(key)
      ? cur.filter((k) => k !== key)
      : [...cur, key];
    onChangeOverride({
      ...override,
      hiddenSections: next.length === 0 ? undefined : next,
    });
  };

  return (
    <div>
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setCopyOpen((o) => !o)}
              aria-label="Duplicate section"
              title="Duplicate section"
              className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press"
            >
              ⧉
            </button>
            {copyOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 border-2 border-line bg-background rounded-md nb-shadow-sm min-w-[220px] max-h-[320px] overflow-y-auto">
                <div className="px-3 py-2 text-[9px] uppercase tracking-[0.2em] font-bold text-muted border-b-2 border-line">
                  Duplicate this section
                </div>
                <button
                  type="button"
                  disabled={copyBusy}
                  onClick={async () => {
                    if (copyBusy) return;
                    setCopyBusy(true);
                    setCopyMsg(null);
                    const res = await onCloneInBrief();
                    setCopyBusy(false);
                    if (res.ok) {
                      setCopyMsg(`Duplicated in this brief ✓`);
                      setCopyOpen(false);
                      setTimeout(() => setCopyMsg(null), 2500);
                    } else {
                      setCopyMsg(`Failed: ${res.error}`);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-paper border-b-2 border-line disabled:opacity-50"
                >
                  <div>+ Duplicate here</div>
                  <div className="text-[10px] text-muted font-normal">
                    Copy pins + overrides into a new section in this brief
                  </div>
                </button>
                {availableBriefs.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[9px] uppercase tracking-[0.2em] font-bold text-muted border-b-2 border-line bg-paper">
                      …or copy to another brief
                    </div>
                    {availableBriefs.map((b) => (
                      <button
                        key={b.slug}
                        type="button"
                        disabled={copyBusy}
                        onClick={() => handleCopyTo(b.slug, b.name)}
                        className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-paper border-b border-line last:border-b-0 disabled:opacity-50"
                      >
                        <div className="truncate">{b.name}</div>
                        <div className="text-[10px] text-muted font-mono truncate">
                          {b.slug}
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {copyMsg && (
        <p className="text-[11px] font-bold border-2 border-line bg-paper px-2 py-1 rounded-sm mb-3">
          {copyMsg}
        </p>
      )}

      <SectionStats
        videos={pinnedVideos}
        visible={publicStatsVisible}
        publicEnabled={publicStatsEnabled}
        onChange={onPublicStatsChange}
      />

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
        {(override.title ||
          override.tagline ||
          override.description ||
          override.script ||
          override.structure ||
          override.tips ||
          override.bestFor ||
          override.hiddenSections) && (
          <button
            type="button"
            onClick={() => onChangeOverride({})}
            className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent underline"
          >
            Reset to default
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h3 className="text-base font-black">
          {effectiveTitle}
          {isSectionHidden("examples") && (
            <span className="ml-2 px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px] font-bold uppercase tracking-widest align-middle">
              VIDEOS HIDDEN
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => toggleSectionHidden("examples")}
          className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          {isSectionHidden("examples") ? "Show videos" : "Hide videos"}
        </button>
      </div>
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
        excludedIds={sectionExcluded}
        scopedProjectIds={scopedProjectIds}
        onPick={onPickVideo}
        placeholder="Search @creator or caption…"
      />

      <div className="mt-6 pt-5 border-t-2 border-line space-y-5">
        <ListEditor
          label="Best For"
          items={override.bestFor}
          defaults={defaultBestFor}
          itemLabel="audience"
          rows={2}
          placeholder="Audience this format works for"
          hidden={isSectionHidden("bestFor")}
          onToggleHidden={() => toggleSectionHidden("bestFor")}
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
          hidden={isSectionHidden("structure")}
          onToggleHidden={() => toggleSectionHidden("structure")}
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
          hidden={isSectionHidden("tips")}
          onToggleHidden={() => toggleSectionHidden("tips")}
          onChange={(next) =>
            onChangeOverride({ ...override, tips: next })
          }
        />
        <div className={isSectionHidden("script") ? "opacity-60" : undefined}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Script
              {isSectionHidden("script") && (
                <span className="ml-2 px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px]">
                  HIDDEN
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleSectionHidden("script")}
              className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              {isSectionHidden("script") ? "Show" : "Hide section"}
            </button>
          </div>
          <textarea
            value={override.script ?? ""}
            onChange={(e) =>
              onChangeOverride({
                ...override,
                script: e.target.value || undefined,
              })
            }
            rows={8}
            placeholder={`00:00 First line of the script.\n00:03 Next line.\n00:11 ...`}
            className="w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed font-mono"
          />
          <p className="text-[10px] text-muted mt-1">
            One line per beat — start each with a timestamp like{" "}
            <code className="font-mono">00:03</code>. Renders as a styled
            script block on the public format page.
          </p>
          <AskClaude
            briefName={briefName}
            formatTitle={effectiveTitle}
            formatTagline={override.tagline ?? defaultTagline}
            formatDescription={override.description ?? defaultDescription}
            structure={(override.structure ?? defaultStructure.map((t) => ({ text: t })))
              .filter((i) => !("hidden" in i ? i.hidden : false))
              .map((i) => (typeof i === "string" ? i : i.text))
              .filter(Boolean)}
            tips={(override.tips ?? defaultTips.map((t) => ({ text: t })))
              .filter((i) => !("hidden" in i ? i.hidden : false))
              .map((i) => (typeof i === "string" ? i : i.text))
              .filter(Boolean)}
            hooks={(() => {
              const cats = hookCategories ?? [];
              const linked = linkedHookSlugs
                .map((s) => cats.find((c) => c.slug === s))
                .filter((c): c is BriefHookCategory => !!c);
              const fromBrief = linked.flatMap((c) =>
                c.hooks.filter((h) => !h.hidden).map((h) => h.text)
              );
              if (fromBrief.length > 0) return fromBrief.filter(Boolean);
              return defaultHookCategories
                .flatMap((c) => c.hooks.map((h) => h.text))
                .filter(Boolean);
            })()}
            currentScript={override.script ?? ""}
            onApply={(text, mode) => {
              const next =
                mode === "replace"
                  ? text
                  : `${(override.script ?? "").trim()}\n${text}`.trim();
              onChangeOverride({ ...override, script: next || undefined });
            }}
          />
        </div>
        <div className={isSectionHidden("hooks") ? "opacity-60" : undefined}>
          <div className="flex items-center justify-end gap-2 mb-2">
            {isSectionHidden("hooks") && (
              <span className="px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px] font-bold uppercase tracking-widest">
                HIDDEN
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleSectionHidden("hooks")}
              className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              {isSectionHidden("hooks") ? "Show hooks" : "Hide hooks"}
            </button>
          </div>
          <FormatHooksInline
            linkedSlugs={linkedHookSlugs}
            defaults={defaultHookCategories}
            hookCategories={hookCategories}
            onChange={onChangeHookCategories}
          />
        </div>
      </div>
    </div>
  );
}

function FormatHooksInline({
  linkedSlugs,
  defaults,
  hookCategories,
  onChange,
}: {
  linkedSlugs: string[];
  defaults: HookCategory[];
  hookCategories: BriefHookCategory[] | null;
  onChange: (next: BriefHookCategory[] | null) => void;
}) {
  const cats = hookCategories ?? [];
  const linkedCats = linkedSlugs
    .map((slug) => cats.find((c) => c.slug === slug))
    .filter((c): c is BriefHookCategory => !!c);
  const missing = linkedSlugs.filter((s) => !cats.find((c) => c.slug === s));

  function importDefaults() {
    const toAdd: BriefHookCategory[] = defaults
      .filter((d) => missing.includes(d.slug))
      .map((d) => ({
        slug: d.slug,
        title: d.title,
        summary: d.summary,
        whyItWorks: d.whyItWorks,
        hooks: d.hooks.map((h) => ({ ...h })),
      }));
    onChange([...cats, ...toAdd]);
  }

  function patchHook(catSlug: string, hookIdx: number, text: string) {
    onChange(
      cats.map((c) => {
        if (c.slug !== catSlug) return c;
        const hooks = [...c.hooks];
        hooks[hookIdx] = { ...hooks[hookIdx], text };
        return { ...c, hooks };
      })
    );
  }

  function toggleHookHidden(catSlug: string, hookIdx: number) {
    onChange(
      cats.map((c) => {
        if (c.slug !== catSlug) return c;
        const hooks = [...c.hooks];
        hooks[hookIdx] = { ...hooks[hookIdx], hidden: !hooks[hookIdx].hidden };
        return { ...c, hooks };
      })
    );
  }

  function addHook(catSlug: string) {
    onChange(
      cats.map((c) =>
        c.slug !== catSlug ? c : { ...c, hooks: [...c.hooks, { text: "" }] }
      )
    );
  }

  function removeHook(catSlug: string, hookIdx: number) {
    onChange(
      cats.map((c) =>
        c.slug !== catSlug
          ? c
          : { ...c, hooks: c.hooks.filter((_, i) => i !== hookIdx) }
      )
    );
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
        Hooks for this format ({linkedCats.reduce((n, c) => n + c.hooks.length, 0)})
      </div>
      {linkedCats.length === 0 && missing.length === 0 && (
        <p className="text-xs text-muted italic">
          No hook categories linked to this format.
        </p>
      )}
      {linkedCats.map((cat) => (
        <div
          key={cat.slug}
          className="border-2 border-line bg-paper rounded-md p-3 mb-2"
        >
          <div className="text-sm font-black mb-2">{cat.title}</div>
          <ul className="space-y-1">
            {cat.hooks.map((h, hi) => (
              <li key={hi} className={`flex gap-1.5 ${h.hidden ? "opacity-50" : ""}`}>
                <span className="font-mono text-[10px] font-bold text-muted pt-2 w-6 text-right shrink-0">
                  {String(hi + 1).padStart(2, "0")}
                </span>
                <input
                  type="text"
                  value={h.text}
                  onChange={(e) => patchHook(cat.slug, hi, e.target.value)}
                  placeholder="Hook text…"
                  className="flex-1 border-2 border-line rounded-md px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
                />
                <button
                  type="button"
                  onClick={() => toggleHookHidden(cat.slug, hi)}
                  aria-label={h.hidden ? "Show on public page" : "Hide from public page"}
                  title={h.hidden ? "Hidden — click to show" : "Visible — click to hide"}
                  className={`border-2 border-line w-8 rounded-md nb-press font-black flex items-center justify-center ${h.hidden ? "bg-paper text-muted" : "bg-background"}`}
                >
                  <EyeIcon off={h.hidden} />
                </button>
                <button
                  type="button"
                  onClick={() => removeHook(cat.slug, hi)}
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
            onClick={() => addHook(cat.slug)}
            className="mt-2 border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
          >
            + Add hook
          </button>
        </div>
      ))}
      {missing.length > 0 && (
        <div className="border-2 border-dashed border-line rounded-md p-3 text-center">
          <p className="text-xs text-muted mb-2">
            {missing.length} linked{" "}
            {missing.length === 1 ? "category" : "categories"} (
            {missing.join(", ")}) using shared defaults — not editable until
            imported.
          </p>
          <button
            type="button"
            onClick={importDefaults}
            className="border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
          >
            Customize for this brief
          </button>
        </div>
      )}
    </div>
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
    <div>
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
    </div>
  );
}
