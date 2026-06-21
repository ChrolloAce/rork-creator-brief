"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HookCategory, VideoExample } from "@/lib/types";
import {
  type ScriptVariant,
  type ScriptStatus,
  normalizeVariants,
  firstLiveBody,
  makeVariantId,
} from "@/lib/scripts";
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
import type { BriefOverview, BriefHookCategory, ContentCalendar, Onboarding } from "@/lib/db";
import { CalendarEditor } from "@/components/admin/CalendarEditor";
import { CollapsibleCard } from "@/components/admin/CollapsibleCard";
import { HooksEditor } from "@/components/admin/HooksEditor";
import { LogoUpload } from "@/components/admin/LogoUpload";
import { OnboardingEditor } from "@/components/admin/OnboardingEditor";
import { OverviewEditor } from "@/components/admin/OverviewEditor";
import { ProjectSources } from "@/components/admin/ProjectSources";
import { VideoChip } from "@/components/admin/VideoChip";
import { VideoPicker } from "@/components/admin/VideoPicker";

type FormatOverride = {
  title?: string;
  tagline?: string;
  description?: string;
  script?: string;
  scriptVariants?: ScriptVariant[];
  structure?: { text: string; image?: string; hidden?: boolean }[];
  tips?: { text: string; image?: string; hidden?: boolean }[];
  bestFor?: { text: string; image?: string; hidden?: boolean }[];
  hiddenSections?: string[];
  sectionOrder?: string[];
  assets?: FormatAssetRow[];
};

type FormatAssetRow = {
  url: string;
  mime: string;
  filename?: string;
  label?: string;
  kind?: "overlay" | "asset" | "verse";
  verseRef?: string;
  verseText?: string;
  verseVersion?: string;
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
  hideFormatsList?: boolean;
  hiddenFormats?: string[];
  deletedFormats?: string[];
  sectionGroups?: { id: string; name: string }[];
  sectionGroupOf?: Record<string, string>;
  contentCalendar?: ContentCalendar;
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
  accessCode?: string | null;
  accessEnabled?: boolean;
  requireLogin?: boolean;
  onboarding?: Onboarding | null;
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
  // Which section's full editor is open in the modal (null = none).
  const [openSection, setOpenSection] = useState<string | null>(null);
  // Section groups that are collapsed in the editor (by group id).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const [allBriefs, setAllBriefs] = useState<
    Array<{ slug: string; name: string }>
  >([]);

  // Track object references for heavy fields we last persisted, so we can
  // omit them from subsequent save payloads when nothing changed.
  // videoMetadata caches pinned-video data; formatOverrides holds inline
  // base64 image uploads — together they can be 10+ MB and exceed proxy
  // body limits otherwise.
  const lastSentMetaRef = useRef<unknown>(undefined);
  const lastSentOverridesRef = useRef<unknown>(undefined);

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
      lastSentMetaRef.current = j1.curation?.videoMetadata;
      lastSentOverridesRef.current = j1.curation?.formatOverrides;
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

  // Section editor modal: close on Escape + lock background scroll.
  useEffect(() => {
    if (!openSection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenSection(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openSection]);

  async function persist(next: Curation) {
    setSaving(true);
    try {
      // Omit heavy fields when their reference hasn't changed since load.
      // videoMetadata + formatOverrides (inline base64 images) can be 10+
      // MB combined and would otherwise be round-tripped on every save.
      const payload: Partial<Curation> = { ...next };
      if (next.videoMetadata === lastSentMetaRef.current) {
        delete payload.videoMetadata;
      } else {
        lastSentMetaRef.current = next.videoMetadata;
      }
      if (next.formatOverrides === lastSentOverridesRef.current) {
        delete payload.formatOverrides;
      } else {
        lastSentOverridesRef.current = next.formatOverrides;
      }
      const res = await fetch(
        `/api/curation?brief=${encodeURIComponent(briefSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ curation: payload }),
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

  const calSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setAndSaveCalendar(next: ContentCalendar | undefined) {
    setCur((c) => {
      if (!c) return c;
      const nextCur: Curation = { ...c, contentCalendar: next };
      // Debounced autosave so day/script edits persist without the user
      // hitting Save. clearTimeout keeps only the latest edit's write.
      if (calSaveTimer.current) clearTimeout(calSaveTimer.current);
      calSaveTimer.current = setTimeout(() => void persist(nextCur), 800);
      return nextCur;
    });
  }

  // Format-override edits (title/script/structure/assets/…) used to update
  // local state only and relied on the user hitting Save — so script edits
  // silently vanished on reload. Debounce-autosave them like the calendar.
  const overrideSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setAndSaveOverride(slug: string, next: FormatOverride) {
    setCur((c) => {
      if (!c) return c;
      const nextCur: Curation = {
        ...c,
        formatOverrides: { ...(c.formatOverrides ?? {}), [slug]: next },
      };
      if (overrideSaveTimer.current) clearTimeout(overrideSaveTimer.current);
      overrideSaveTimer.current = setTimeout(() => void persist(nextCur), 800);
      return nextCur;
    });
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

  const deletedSet = new Set<string>(cur.deletedFormats ?? []);
  const baseSlugs = formatsMeta.map((f) => f.slug);
  const cloneSlugs = Object.keys(cur.formatClones ?? {});
  const allSlugs = [...baseSlugs, ...cloneSlugs].filter(
    (s) => !deletedSet.has(s)
  );

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

  // Visible formats (title + a thumbnail) offered as calendar links. Hidden
  // formats are excluded since a public link to them would 404. Thumbnail
  // falls back through the format's first pinned/auto preview video.
  const calendarFormats = effectiveOrder
    .filter((slug) => !hiddenSet.has(slug))
    .flatMap((slug) => {
      const meta = metaFor(slug);
      if (!meta) return [];
      const title = cur.formatOverrides?.[slug]?.title ?? meta.title;
      const p = preview[slug];
      const thumbnail =
        p?.pinnedVideos?.[0]?.thumbnail ??
        p?.autoVideos?.[0]?.thumbnail ??
        meta.thumbnail;
      return [{ slug, title, thumbnail }];
    });

  // Editor script groups → { id, name, slugs } for the calendar's alternation
  // auto-fill. Only visible sections; only non-empty groups.
  const calendarScriptGroups = (cur.sectionGroups ?? [])
    .map((g) => ({
      id: g.id,
      name: g.name,
      slugs: effectiveOrder.filter(
        (s) => (cur.sectionGroupOf?.[s] ?? "") === g.id && !hiddenSet.has(s)
      ),
    }))
    .filter((g) => g.slugs.length > 0);

  // All formats in this brief (incl. hidden) as { slug, title } — used by the
  // per-format "Copy from another format" picker.
  const allFormatsList = effectiveOrder.flatMap((slug) => {
    const meta = metaFor(slug);
    if (!meta) return [];
    return [{ slug, title: cur.formatOverrides?.[slug]?.title ?? meta.title }];
  });

  // Materialize a meta list value (string | {text,...}) into override rows.
  function toRows(
    items: ReadonlyArray<string | { text: string; image?: string; hidden?: boolean }>
  ): { text: string; image?: string; hidden?: boolean }[] {
    return items.map((i) =>
      typeof i === "string" ? { text: i } : { ...i }
    );
  }

  // Copy selected parts from another format in this brief into `targetSlug`'s
  // override. Each part takes the SOURCE's effective value (its override if set,
  // else its static meta default) so the target ends up looking like the source.
  function copyPartsFromFormat(
    targetSlug: string,
    sourceSlug: string,
    parts: string[]
  ) {
    if (!cur || parts.length === 0) return;
    const srcMeta = metaFor(sourceSlug);
    const srcOv = cur.formatOverrides?.[sourceSlug] ?? {};
    const tgtOv = cur.formatOverrides?.[targetSlug] ?? {};
    const nextOv: FormatOverride = { ...tgtOv };
    let overrideTouched = false;
    for (const part of parts) {
      if (part === "assets") {
        nextOv.assets = srcOv.assets ? srcOv.assets.map((a) => ({ ...a })) : undefined;
        overrideTouched = true;
      } else if (part === "sectionOrder") {
        nextOv.sectionOrder = srcOv.sectionOrder ? [...srcOv.sectionOrder] : undefined;
        overrideTouched = true;
      } else if (part === "hiddenSections") {
        nextOv.hiddenSections = srcOv.hiddenSections ? [...srcOv.hiddenSections] : undefined;
        overrideTouched = true;
      } else if (part === "script") {
        nextOv.script = srcOv.script ?? srcMeta?.script;
        nextOv.scriptVariants = srcOv.scriptVariants
          ? srcOv.scriptVariants.map((v) => ({ ...v, id: makeVariantId() }))
          : undefined;
        overrideTouched = true;
      } else if (part === "structure") {
        nextOv.structure = srcOv.structure
          ? srcOv.structure.map((i) => ({ ...i }))
          : srcMeta
            ? toRows(srcMeta.structure)
            : undefined;
        overrideTouched = true;
      }
    }
    const nextCur: Curation = { ...cur };
    if (overrideTouched) {
      nextCur.formatOverrides = {
        ...(cur.formatOverrides ?? {}),
        [targetSlug]: nextOv,
      };
    }
    // "pins" copies the source format's videos. Metadata is keyed globally by
    // dbId, so copying the id list is enough for the pins to resolve.
    if (parts.includes("pins")) {
      const srcPins = cur.formatPins?.[sourceSlug] ?? [];
      nextCur.formatPins = { ...cur.formatPins, [targetSlug]: [...srcPins] };
      setPreview((p) => ({
        ...p,
        [targetSlug]: {
          pinnedVideos: [...(p[sourceSlug]?.pinnedVideos ?? [])],
          autoVideos: p[targetSlug]?.autoVideos ?? [],
        },
      }));
    }
    setCur(nextCur);
    void persist(nextCur);
  }

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

  // Completely remove a section. Clones are deleted outright (clone mapping +
  // its overrides/pins/buckets); base/static formats are recorded in
  // deletedFormats so they stop appearing here and on the public brief.
  function deleteFormat(slug: string) {
    if (!cur) return;
    const isClone = !!cur.formatClones?.[slug];
    const nextClones = { ...(cur.formatClones ?? {}) };
    const nextOverrides = { ...(cur.formatOverrides ?? {}) };
    const nextPins = { ...cur.formatPins };
    const nextBuckets = { ...cur.formatBuckets };
    delete nextClones[slug];
    delete nextOverrides[slug];
    delete nextPins[slug];
    delete nextBuckets[slug];
    const nextCur: Curation = {
      ...cur,
      formatClones: nextClones,
      formatOverrides: nextOverrides,
      formatPins: nextPins,
      formatBuckets: nextBuckets,
      formatOrder: (cur.formatOrder ?? effectiveOrder).filter((s) => s !== slug),
      hiddenFormats: (cur.hiddenFormats ?? []).filter((s) => s !== slug),
      deletedFormats: isClone
        ? (cur.deletedFormats ?? []).filter((s) => s !== slug)
        : [...new Set([...(cur.deletedFormats ?? []), slug])],
    };
    setCur(nextCur);
    setPreview((p) => {
      const rest = { ...p };
      delete rest[slug];
      return rest;
    });
    if (openSection === slug) setOpenSection(null);
    void persist(nextCur);
  }

  function createGroup() {
    if (!cur) return;
    const name = window.prompt("Name this group", "New group")?.trim();
    if (!name) return;
    const nextCur: Curation = {
      ...cur,
      sectionGroups: [
        ...(cur.sectionGroups ?? []),
        { id: makeVariantId(), name },
      ],
    };
    setCur(nextCur);
    void persist(nextCur);
  }

  function renameGroup(id: string, current: string) {
    if (!cur) return;
    const name = window.prompt("Rename group", current)?.trim();
    if (!name) return;
    const nextCur: Curation = {
      ...cur,
      sectionGroups: (cur.sectionGroups ?? []).map((g) =>
        g.id === id ? { ...g, name } : g
      ),
    };
    setCur(nextCur);
    void persist(nextCur);
  }

  // Removes the group itself; its sections fall back to Ungrouped (not deleted).
  function deleteGroup(id: string) {
    if (!cur) return;
    const nextMap = { ...(cur.sectionGroupOf ?? {}) };
    for (const slug of Object.keys(nextMap)) {
      if (nextMap[slug] === id) delete nextMap[slug];
    }
    const nextCur: Curation = {
      ...cur,
      sectionGroups: (cur.sectionGroups ?? []).filter((g) => g.id !== id),
      sectionGroupOf: nextMap,
    };
    setCur(nextCur);
    void persist(nextCur);
  }

  function setSectionGroup(slug: string, groupId: string) {
    if (!cur) return;
    const nextMap = { ...(cur.sectionGroupOf ?? {}) };
    if (groupId) nextMap[slug] = groupId;
    else delete nextMap[slug];
    const nextCur: Curation = { ...cur, sectionGroupOf: nextMap };
    setCur(nextCur);
    void persist(nextCur);
  }

  // Add a new script to a group by cloning the last section already in it
  // (so it inherits the same script — you just tweak the CTA). Falls back to
  // the first section overall when the group is empty.
  async function addScriptToGroup(groupId: string) {
    if (!cur) return;
    const inGroup = effectiveOrder.filter(
      (s) => (cur.sectionGroupOf?.[s] ?? "") === groupId
    );
    const source = inGroup[inGroup.length - 1] ?? effectiveOrder[0];
    if (!source) {
      window.alert("Add a section to the brief first to copy from.");
      return;
    }
    const res = await cloneSectionInBrief(source); // calls load()
    if (!res.ok || !res.newSlug) {
      window.alert(res.error ?? "Could not add script");
      return;
    }
    const newSlug = res.newSlug;
    setCur((c) => {
      if (!c) return c;
      const nextCur: Curation = {
        ...c,
        sectionGroupOf: { ...(c.sectionGroupOf ?? {}), [newSlug]: groupId },
      };
      void persist(nextCur);
      return nextCur;
    });
    setOpenSection(newSlug);
  }

  function toggleGroupCollapsed(id: string) {
    setCollapsedGroups((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sectionGroups = cur.sectionGroups ?? [];
  // One compact section tile (used inside every group + the ungrouped grid).
  const renderTile = (slug: string) => {
    const meta = metaFor(slug);
    if (!meta) return null;
    const override = cur.formatOverrides?.[slug] ?? {};
    const effectiveTitle = override.title ?? meta.title;
    const pinCount = (cur.formatPins[slug] ?? []).length;
    const isClone = !!cur.formatClones?.[slug];
    const isHidden = hiddenSet.has(slug);
    const isOpen = openSection === slug;
    const groupId = cur.sectionGroupOf?.[slug] ?? "";
    return (
      <div
        key={slug}
        className={`border-2 rounded-md bg-background p-2.5 flex flex-col gap-2 ${
          isOpen ? "border-accent nb-shadow-sm" : "border-line"
        } ${isHidden ? "opacity-60" : ""}`}
      >
        <button
          type="button"
          onClick={() => setOpenSection(isOpen ? null : slug)}
          className="text-left flex-1"
        >
          <div className="text-xs font-black uppercase tracking-wide leading-snug line-clamp-2">
            {effectiveTitle}
          </div>
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold text-muted mt-1">
            {isHidden ? "HIDDEN · " : ""}
            {isClone ? "COPY · " : ""}
            {pinCount} {pinCount === 1 ? "video" : "videos"}
          </div>
        </button>
        <select
          value={groupId}
          onChange={(e) => setSectionGroup(slug, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title="Move to group"
          className="w-full border-2 border-line bg-background rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase tracking-widest focus:outline-none focus:border-accent"
        >
          <option value="">Ungrouped</option>
          {sectionGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 mt-auto">
          <button
            type="button"
            onClick={() => setOpenSection(isOpen ? null : slug)}
            className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
          >
            {isOpen ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => toggleFormatHidden(slug)}
            aria-label={isHidden ? "Show on public brief" : "Hide from public brief"}
            title={isHidden ? "Hidden — click to publish" : "Hide from public brief"}
            className={`w-7 h-7 border-2 border-line rounded-sm font-black nb-press flex items-center justify-center ${isHidden ? "bg-paper text-muted" : "bg-background"}`}
          >
            <EyeIcon off={isHidden} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Delete "${effectiveTitle}" completely? This can't be undone.`
                )
              )
                deleteFormat(slug);
            }}
            aria-label="Delete section"
            title="Delete this section completely"
            className="ml-auto w-7 h-7 border-2 border-line rounded-sm font-black nb-press flex items-center justify-center bg-background hover:bg-paper"
          >
            🗑
          </button>
        </div>
      </div>
    );
  };

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
            href={`/admin/b/${brief.slug}/creators`}
            className="border-2 border-line bg-accent text-accent-ink px-2 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
          >
            Submissions
          </a>
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
          storageKey={`brief-editor:${briefSlug}:access`}
          title="Creator access"
          meta={brief.accessEnabled ? "Gate ON" : "Not live"}
        >
          <CreatorAccess
            brief={brief}
            briefSlug={briefSlug}
            onSave={saveBrief}
          />
        </CollapsibleCard>

        <CollapsibleCard
          storageKey={`brief-editor:${briefSlug}:onboarding`}
          title="Onboarding"
          meta={
            brief.onboarding?.enabled
              ? `${brief.onboarding.steps?.length ?? 0} steps`
              : "Off"
          }
        >
          <OnboardingEditor
            value={brief.onboarding}
            scopedProjectIds={cur.scopedProjectIds}
            onSave={(onboarding) => {
              void saveBrief({ onboarding });
            }}
          />
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

        <CollapsibleCard
          storageKey={`brief-editor:${briefSlug}:calendar`}
          title="Content calendar"
          meta={
            cur.contentCalendar?.enabled
              ? `${cur.contentCalendar.days?.length ?? 0} days`
              : "Hidden"
          }
        >
          <label className="flex items-start gap-2 mb-4 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!cur.hideFormatsList}
              onChange={(e) => {
                const next: Curation = {
                  ...cur,
                  hideFormatsList: e.target.checked,
                };
                setCur(next);
                void persist(next);
              }}
            />
            <span>
              Calendar-only mode — hide the Formats list from creators. They
              won&apos;t see all your formats or their names; formats only show
              up through the calendar as you schedule them.{" "}
              <span className="text-muted font-normal">
                (Format pages still open via calendar links.)
              </span>
            </span>
          </label>
          <CalendarEditor
            value={cur.contentCalendar}
            formats={calendarFormats}
            scriptGroups={calendarScriptGroups}
            onChange={setAndSaveCalendar}
          />
        </CollapsibleCard>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted">
            Sections
          </div>
          <button
            type="button"
            onClick={createGroup}
            className="border-2 border-line bg-ink text-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            + New group
          </button>
        </div>

        {/* Grouped sections — each group is a collapsible grid. */}
        {sectionGroups.map((g) => {
          const slugs = effectiveOrder.filter(
            (s) => (cur.sectionGroupOf?.[s] ?? "") === g.id
          );
          const collapsed = collapsedGroups.has(g.id);
          return (
            <section
              key={g.id}
              className="border-2 border-line bg-background rounded-md nb-shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-paper border-b-2 border-line">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(g.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span
                    className={`font-black text-base leading-none transition-transform ${collapsed ? "" : "rotate-180"}`}
                  >
                    ▾
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest truncate">
                    {g.name}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
                    {slugs.length}
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void addScriptToGroup(g.id)}
                    title="Add a script to this group (copies the last one so you just tweak the CTA)"
                    className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    + Script
                  </button>
                  <button
                    type="button"
                    onClick={() => renameGroup(g.id, g.name)}
                    className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete group "${g.name}"? Its scripts move to Ungrouped (they are NOT deleted).`
                        )
                      )
                        deleteGroup(g.id);
                    }}
                    title="Delete group (keeps the scripts)"
                    className="w-7 h-7 border-2 border-line bg-background rounded-sm nb-press text-[10px] font-black flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {!collapsed && (
                <div className="p-2.5">
                  {slugs.length === 0 ? (
                    <p className="text-[10px] text-muted text-center py-3">
                      Empty — use the group dropdown on any tile to move scripts
                      here, or hit “+ Script”.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {slugs.map((slug) => renderTile(slug))}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* Ungrouped sections (also catches any orphaned group ids). */}
        {(() => {
          const slugs = effectiveOrder.filter((s) => {
            const gid = cur.sectionGroupOf?.[s] ?? "";
            return !gid || !sectionGroups.some((g) => g.id === gid);
          });
          if (slugs.length === 0) return null;
          return (
            <div>
              {sectionGroups.length > 0 && (
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2 mt-1">
                  Ungrouped
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {slugs.map((slug) => renderTile(slug))}
              </div>
            </div>
          );
        })()}

        {/* Full editor for the open section */}
        {openSection &&
          (() => {
            const slug = openSection;
            const idx = effectiveOrder.indexOf(slug);
            const meta = metaFor(slug);
            if (idx < 0 || !meta) return null;
            const override = cur.formatOverrides?.[slug] ?? {};
            const effectiveTitle = override.title ?? meta.title;
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink/50"
                onClick={() => setOpenSection(null)}
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-background border-2 border-line rounded-md nb-shadow overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-paper border-b-2 border-line">
                    <span className="text-sm font-black uppercase tracking-widest truncate">
                      Editing · {effectiveTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenSection(null)}
                      className="border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest shrink-0"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="p-4 sm:p-5 overflow-y-auto">
                    <FormatSection
                    slug={slug}
                    briefName={brief.name}
            availableBriefs={allBriefs.filter((b) => b.slug !== briefSlug)}
            onCopyToBrief={(targetSlug) =>
              copySectionToBrief(targetSlug, slug)
            }
            onCloneInBrief={() => cloneSectionInBrief(slug)}
            allFormats={allFormatsList}
            onCopyPartsFrom={(sourceSlug, parts) =>
              copyPartsFromFormat(slug, sourceSlug, parts)
            }
            publicStatsVisible={publicStatsVisible}
            publicStatsEnabled={publicStatsEnabled}
            onPublicStatsChange={updatePublicStats}
            defaultTitle={meta.title}
            defaultTagline={meta.tagline}
            defaultDescription={meta.description}
            defaultStructure={meta.structure.map((i) =>
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
                    onChangeOverride={(next) => setAndSaveOverride(slug, next)}
                  />
                  </div>
                </div>
              </div>
            );
          })()}

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

type CreatorRow = {
  id: string;
  name: string;
  createdAt: string;
  answers: Record<string, unknown> | null;
  status?: "onboarded" | "approved";
};

function CreatorList({
  label,
  rows,
  tone,
}: {
  label: string;
  rows: CreatorRow[];
  tone: "approved" | "onboarded";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
        {label} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted italic">None yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li
              key={c.id}
              className={`flex items-center justify-between gap-2 border-2 border-line rounded-md px-2.5 py-1.5 ${
                tone === "approved" ? "bg-success/15" : "bg-background"
              }`}
            >
              <span className="font-bold text-sm truncate">{c.name}</span>
              <span className="text-[10px] text-muted font-mono shrink-0">
                {new Date(c.createdAt).toLocaleDateString()} ·{" "}
                {Object.keys(c.answers ?? {}).length} answers
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreatorAccess({
  brief,
  briefSlug,
  onSave,
}: {
  brief: BriefRecord;
  briefSlug: string;
  onSave: (patch: Partial<BriefRecord>) => Promise<void>;
}) {
  const [code, setCode] = useState(brief.accessCode ?? "");
  const [creators, setCreators] = useState<CreatorRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCreators() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/briefs/${encodeURIComponent(briefSlug)}/creators`,
        { cache: "no-store" }
      );
      const j = await res.json();
      if (j.ok) setCreators(j.creators as CreatorRow[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefSlug]);

  const codeDirty = (code.trim() || null) !== (brief.accessCode || null);

  return (
    <div className="space-y-4">
      <div className="border-2 border-line bg-paper rounded-md p-3 text-xs leading-relaxed">
        <span className="font-bold">How it works:</span> set a shared passcode.
        When the gate is live, creators open the brief, enter their{" "}
        <span className="font-bold">name</span> + this{" "}
        <span className="font-bold">code</span>, and get recorded below.{" "}
        <span className="font-bold">Not live yet</span> — the toggle does nothing
        public until the gate screen ships.
      </div>

      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
        <input
          type="checkbox"
          checked={!!brief.accessEnabled}
          onChange={(e) => onSave({ accessEnabled: e.target.checked })}
        />
        <span>Lock the brief — require the code to enter</span>
      </label>
      <label
        className={`flex items-center gap-2 text-xs font-bold cursor-pointer ${
          brief.accessEnabled ? "" : "opacity-50"
        }`}
      >
        <input
          type="checkbox"
          checked={brief.requireLogin !== false}
          onChange={(e) => onSave({ requireLogin: e.target.checked })}
        />
        <span>
          Also require an account (email + password). Off = code only, no login.
        </span>
      </label>

      <div className="flex items-end gap-2 flex-wrap">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Brief passcode
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. LOVABLE2026"
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        {codeDirty && (
          <button
            type="button"
            onClick={() => onSave({ accessCode: code.trim() || null })}
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs"
          >
            Save code
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Creators
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/admin/b/${briefSlug}/creators`}
              className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline"
            >
              Submissions page →
            </a>
            <button
              type="button"
              onClick={() => void loadCreators()}
              className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent underline"
            >
              Refresh
            </button>
          </div>
        </div>
        {loading && creators === null ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (creators?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted italic">
            No creators yet — they appear here once people go through onboarding.
          </p>
        ) : (
          <div className="space-y-3">
            <CreatorList
              label="✅ Approved — entered the code & got in"
              rows={(creators ?? []).filter((c) => c.status === "approved")}
              tone="approved"
            />
            <CreatorList
              label="⏳ Finished onboarding — awaiting code"
              rows={(creators ?? []).filter((c) => c.status !== "approved")}
              tone="onboarded"
            />
          </div>
        )}
      </div>
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

// Upload a data URL to the image_blob table, return a stable URL. Keeps
// the curation JSON small (~50 KB instead of 10+ MB of inline base64).
async function uploadDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.url) {
    throw new Error(j.error ?? `upload failed: HTTP ${res.status}`);
  }
  return j.url as string;
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
            const dataUrl = await resizeImage(f);
            const url = await uploadDataUrl(dataUrl);
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
  headerAction,
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
  headerAction?: ReactNode;
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
        <div className="flex items-center gap-1.5 shrink-0">
          {headerAction}
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

// Editable section order with HTML5 drag-and-drop + up/down buttons.
const SECTION_LABELS: Record<string, string> = {
  script: "Script",
  examples: "Example videos",
  structure: "Shot-by-shot structure",
  hooks: "Hooks",
  assets: "Downloadable assets",
};
const ALL_SECTION_KEYS = [
  "script",
  "examples",
  "structure",
  "hooks",
  "assets",
];

function SectionOrderEditor({
  value,
  onChange,
  headerAction,
}: {
  value: string[] | undefined;
  onChange: (next: string[] | undefined) => void;
  headerAction?: ReactNode;
}) {
  const order = (() => {
    if (!value || value.length === 0) return ALL_SECTION_KEYS;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of value) {
      if (ALL_SECTION_KEYS.includes(k) && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
    for (const k of ALL_SECTION_KEYS) if (!seen.has(k)) out.push(k);
    return out;
  })();

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const isCustom = !!value && value.length > 0;

  function move(from: number, to: number) {
    if (from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Section order
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {headerAction}
          {isCustom && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent underline"
            >
              Reset to default
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-1">
        {order.map((key, i) => (
          <li
            key={key}
            draggable
            onDragStart={(e) => {
              setDragIdx(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overIdx !== i) setOverIdx(i);
            }}
            onDragLeave={() => {
              if (overIdx === i) setOverIdx(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) move(from, i);
              setDragIdx(null);
              setOverIdx(null);
            }}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
            className={`flex items-center gap-2 border-2 rounded-md px-2 py-1.5 bg-background cursor-grab active:cursor-grabbing ${
              overIdx === i && dragIdx !== i
                ? "border-accent bg-accent/10"
                : "border-line"
            } ${dragIdx === i ? "opacity-50" : ""}`}
          >
            <span className="font-black text-muted leading-none select-none" aria-hidden>
              ⠿
            </span>
            <span className="font-mono text-[10px] font-bold text-muted shrink-0 w-6">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-sm font-bold truncate">
              {SECTION_LABELS[key] ?? key}
            </span>
            <button
              type="button"
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={i === order.length - 1}
              onClick={() => move(i, i + 1)}
              className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted mt-2">
        Drag the rows or use the arrows to reorder. The order applies to the
        public brief page for this format only.
      </p>
    </div>
  );
}

function AssetManager({
  assets,
  onChange,
  headerAction,
}: {
  assets: FormatAssetRow[];
  onChange: (next: FormatAssetRow[] | undefined) => void;
  headerAction?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // "App card" asset builder.
  const [cardOpen, setCardOpen] = useState(false);
  const [cardTerm, setCardTerm] = useState("");
  const [cardApps, setCardApps] = useState<
    { id: string; name: string; developer: string; icon: string }[] | null
  >(null);
  const [cardBusy, setCardBusy] = useState(false);
  // Bible verse builder.
  const [verseOpen, setVerseOpen] = useState(false);
  const [verseRefInput, setVerseRefInput] = useState("");
  const [verseData, setVerseData] = useState<{
    ref: string;
    text: string;
    version: string;
  } | null>(null);
  const [verseBusy, setVerseBusy] = useState(false);
  const [verseErr, setVerseErr] = useState<string | null>(null);

  function update(next: FormatAssetRow[]) {
    onChange(next.length === 0 ? undefined : next);
  }

  async function fetchVerse() {
    const r = verseRefInput.trim();
    if (!r) return;
    setVerseBusy(true);
    setVerseErr(null);
    setVerseData(null);
    try {
      const res = await fetch(`/api/bible?ref=${encodeURIComponent(r)}`);
      const j = await res.json();
      if (!j.ok) {
        setVerseErr(j.error ?? "Couldn't find that verse.");
        return;
      }
      setVerseData({ ref: j.reference, text: j.text, version: j.translation });
    } catch (e) {
      setVerseErr((e as Error).message);
    } finally {
      setVerseBusy(false);
    }
  }
  function addVerse() {
    if (!verseData) return;
    const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`;
    const url = `/api/verse-card?${q("ref", verseData.ref)}&${q("text", verseData.text)}&${q("version", verseData.version)}&style=mountains`;
    update([
      ...assets,
      {
        kind: "verse",
        url,
        mime: "image/png",
        filename: `${verseData.ref.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`,
        label: verseData.ref,
        verseRef: verseData.ref,
        verseText: verseData.text,
        verseVersion: verseData.version,
      },
    ]);
    setVerseOpen(false);
    setVerseData(null);
    setVerseRefInput("");
  }

  async function searchCardApps() {
    const t = cardTerm.trim();
    if (!t) return;
    setCardBusy(true);
    try {
      const res = await fetch(
        `/api/itunes-search?term=${encodeURIComponent(t)}&country=us`
      );
      const j = await res.json();
      if (j.ok) setCardApps(j.apps);
    } finally {
      setCardBusy(false);
    }
  }
  function addCard(app: { id: string; name: string }) {
    update([
      ...assets,
      {
        url: `/api/app-card?id=${app.id}&country=us`,
        mime: "image/png",
        filename: `${app.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-card.png`,
        label: `${app.name} — app card`,
        kind: "asset",
      },
    ]);
    setCardOpen(false);
    setCardApps(null);
    setCardTerm("");
  }

  async function uploadFile(file: File) {
    setErr(null);
    setBusy(true);
    setProgress(`Uploading ${file.name} (${Math.round(file.size / (1024 * 1024))} MB)…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) {
        throw new Error(j.error ?? `upload failed: HTTP ${res.status}`);
      }
      const isOverlay = file.type.startsWith("video/") && assets.every((a) => a.kind !== "overlay");
      const newAsset: FormatAssetRow = {
        url: j.url,
        mime: j.mime ?? file.type,
        filename: j.filename ?? file.name,
        label: "",
        kind: isOverlay ? "overlay" : "asset",
      };
      update([...assets, newAsset]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function patch(i: number, p: Partial<FormatAssetRow>) {
    const next = [...assets];
    next[i] = { ...next[i], ...p };
    update(next);
  }

  function toggleOverlay(i: number) {
    const next = assets.map((a, j) => {
      if (j === i) return { ...a, kind: a.kind === "overlay" ? "asset" : "overlay" } as FormatAssetRow;
      // Only one overlay per format — demote others when promoting this one.
      if (assets[i].kind !== "overlay") return { ...a, kind: "asset" } as FormatAssetRow;
      return a;
    });
    update(next);
  }

  function remove(i: number) {
    update(assets.filter((_, j) => j !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= assets.length) return;
    const next = [...assets];
    [next[i], next[target]] = [next[target], next[i]];
    update(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Downloadable assets ({assets.length})
        </div>
        {headerAction}
      </div>

      <div className="space-y-2">
        {assets.map((a, i) => {
          const isVideo = a.mime.startsWith("video/");
          const isImage = a.mime.startsWith("image/");
          const isOverlay = a.kind === "overlay";
          return (
            <div
              key={i}
              className={`flex gap-2 items-start border-2 rounded-md p-2 ${
                isOverlay ? "border-accent bg-accent/10" : "border-line bg-paper"
              }`}
            >
              <div className="shrink-0 w-20 h-20 border-2 border-line bg-background rounded-sm overflow-hidden flex items-center justify-center">
                {isImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.url} alt="" className="w-full h-full object-cover" />
                ) : isVideo ? (
                  <video src={a.url} className="w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  <span className="text-[10px] font-black text-muted">FILE</span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-[10px] font-mono truncate text-muted">{a.filename ?? a.url}</div>
                <input
                  type="text"
                  value={a.label ?? ""}
                  onChange={(e) => patch(i, { label: e.target.value })}
                  placeholder="Label (e.g. 'TikTok-safe vertical cut')"
                  className="w-full border-2 border-line rounded-md px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
                    {a.mime}
                  </span>
                  {isVideo && (
                    <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOverlay}
                        onChange={() => toggleOverlay(i)}
                      />
                      <span className={isOverlay ? "text-accent" : ""}>
                        Overlay example
                      </span>
                    </label>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === assets.length - 1}
                  onClick={() => move(i, 1)}
                  className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => remove(i)}
                  className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadFile(f);
        }}
      />
      <div className="mt-2 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex-1 min-w-[160px] border-2 border-dashed border-line bg-background rounded-md px-2 py-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-accent hover:border-accent disabled:opacity-40"
        >
          {busy ? progress ?? "Uploading…" : "+ Add file (image / video)"}
        </button>
        <button
          type="button"
          onClick={() => setCardOpen((o) => !o)}
          className="flex-1 min-w-[160px] border-2 border-dashed border-line bg-background rounded-md px-2 py-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
        >
          + App card (live reviews)
        </button>
        <button
          type="button"
          onClick={() => setVerseOpen((o) => !o)}
          className="flex-1 min-w-[160px] border-2 border-dashed border-line bg-background rounded-md px-2 py-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
        >
          + Bible verse
        </button>
      </div>

      {verseOpen && (
        <div className="mt-2 border-2 border-line bg-paper rounded-md p-2 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={verseRefInput}
              onChange={(e) => setVerseRefInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void fetchVerse();
                }
              }}
              placeholder="Verse reference (e.g. John 3:16, Psalm 23:1-3)"
              className="flex-1 border-2 border-line rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
            />
            <button
              type="button"
              onClick={() => void fetchVerse()}
              disabled={verseBusy || !verseRefInput.trim()}
              className="border-2 border-line bg-ink text-background rounded-sm px-3 py-1 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-40"
            >
              {verseBusy ? "…" : "Fetch"}
            </button>
          </div>
          {verseErr && (
            <p className="text-xs font-bold text-[#b91c1c]">{verseErr}</p>
          )}
          {verseData && (
            <div className="border-2 border-line bg-background rounded-sm p-2 space-y-2">
              <div className="text-sm italic leading-relaxed">
                “{verseData.text}”
              </div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted">
                {verseData.ref} · {verseData.version}
              </div>
              <button
                type="button"
                onClick={addVerse}
                className="w-full border-2 border-line bg-accent text-accent-ink rounded-sm px-2 py-1.5 text-[10px] font-black uppercase tracking-widest nb-press"
              >
                Add verse (creators pick a style)
              </button>
            </div>
          )}
          <p className="text-[10px] text-muted">
            Creators get this verse with multiple downloadable styles (clean,
            pink, girly, boyish, photo, etc.).
          </p>
        </div>
      )}

      {cardOpen && (
        <div className="mt-2 border-2 border-line bg-paper rounded-md p-2 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={cardTerm}
              onChange={(e) => setCardTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchCardApps();
                }
              }}
              placeholder="Search your app (e.g. Prayer Lock)"
              className="flex-1 border-2 border-line rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
            />
            <button
              type="button"
              onClick={() => void searchCardApps()}
              disabled={cardBusy || !cardTerm.trim()}
              className="border-2 border-line bg-ink text-background rounded-sm px-3 py-1 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-40"
            >
              {cardBusy ? "…" : "Search"}
            </button>
          </div>
          {cardApps && (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {cardApps.length === 0 ? (
                <p className="text-xs text-muted italic">No apps found.</p>
              ) : (
                cardApps.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => addCard(a)}
                    className="w-full flex items-center gap-2 text-left border-2 border-line bg-background rounded-sm p-1.5 nb-press"
                  >
                    {a.icon && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={a.icon} alt="" className="w-9 h-9 rounded-md border-2 border-line shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-xs truncate">{a.name}</span>
                      <span className="block text-[10px] text-muted truncate">{a.developer}</span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest shrink-0">Add →</span>
                  </button>
                ))
              )}
            </div>
          )}
          <p className="text-[10px] text-muted">
            Adds a downloadable card image that always shows the app&rsquo;s
            current rating + latest reviews.
          </p>
        </div>
      )}
      {err && (
        <p className="mt-2 text-xs font-bold text-[#b91c1c] border-2 border-line bg-background px-2 py-1 rounded-sm">
          {err}
        </p>
      )}
      <p className="text-[10px] text-muted mt-1">
        Public viewers see these as download buttons under the script. Mark one
        video as <span className="font-bold">Overlay example</span> to play it
        inline on the brief page.
      </p>
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
  onApply: (text: string, mode: "replace" | "append" | "new") => void;
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
                onApply(draft, "new");
                setDraft("");
              }}
              className="border-2 border-line bg-ink text-background px-3 py-1 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              + New variant
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

function nextVariantLabel(variants: ScriptVariant[]): string {
  const used = new Set(variants.map((v) => v.label.trim().toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return letter;
  }
  return `V${variants.length + 1}`;
}

const STATUS_STYLE: Record<ScriptStatus, string> = {
  live: "bg-accent text-accent-ink border-line",
  draft: "bg-paper text-ink border-line",
  archived: "bg-background text-muted border-line",
};

function ScriptManager({
  variants,
  onChange,
  isHidden,
  onToggleHidden,
  headerAction,
  briefName,
  formatTitle,
  formatTagline,
  formatDescription,
  structure,
  hooks,
}: {
  variants: ScriptVariant[];
  onChange: (next: ScriptVariant[]) => void;
  isHidden: boolean;
  onToggleHidden: () => void;
  headerAction: ReactNode;
  briefName: string;
  formatTitle: string;
  formatTagline: string;
  formatDescription: string;
  structure: string[];
  hooks: string[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = variants.filter((v) => v.status !== "archived");
  const archived = variants.filter((v) => v.status === "archived");
  const liveCount = variants.filter((v) => v.status === "live").length;

  const selected =
    (selectedId && active.find((v) => v.id === selectedId)) || active[0] || null;

  function update(id: string, patch: Partial<ScriptVariant>) {
    onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }
  function addVariant(body = "", select = true) {
    const id = makeVariantId();
    // First-ever variant goes live so the public page shows something;
    // later ones start as drafts you promote when ready.
    const status: ScriptStatus = variants.length === 0 ? "live" : "draft";
    onChange([
      ...variants,
      { id, label: nextVariantLabel(variants), body, status },
    ]);
    if (select) setSelectedId(id);
  }
  function duplicate(v: ScriptVariant) {
    const id = makeVariantId();
    const idx = variants.findIndex((x) => x.id === v.id);
    const copy: ScriptVariant = {
      id,
      label: `${nextVariantLabel(variants)} · copy of ${v.label}`,
      body: v.body,
      status: "draft",
    };
    const next = [...variants];
    next.splice(idx + 1, 0, copy);
    onChange(next);
    setSelectedId(id);
  }
  function remove(id: string) {
    onChange(variants.filter((v) => v.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted flex items-center gap-2">
          Scripts
          <span className="text-muted/70 normal-case tracking-normal font-normal">
            {active.length} active · {liveCount} live
          </span>
          {isHidden && (
            <span className="px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px]">
              HIDDEN
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {headerAction}
          <button
            type="button"
            onClick={() => addVariant()}
            className="border-2 border-line bg-ink text-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            + New
          </button>
          <button
            type="button"
            onClick={onToggleHidden}
            className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {isHidden ? "Show" : "Hide section"}
          </button>
        </div>
      </div>

      {active.length === 0 ? (
        <button
          type="button"
          onClick={() => addVariant()}
          className="w-full border-2 border-dashed border-line rounded-md py-8 text-sm font-bold text-muted hover:text-ink hover:border-accent nb-press"
        >
          + Add your first script
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {active.map((v) => {
            const isSel = selected?.id === v.id;
            return (
              <div
                key={v.id}
                className={`border-2 rounded-md bg-background p-2 flex flex-col gap-1.5 ${
                  isSel ? "border-accent nb-shadow-sm" : "border-line"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <input
                    value={v.label}
                    onChange={(e) => update(v.id, { label: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-xs font-black uppercase tracking-wide focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(v.id, {
                        status: v.status === "live" ? "draft" : "live",
                      })
                    }
                    title={v.status === "live" ? "Live — click to make draft" : "Set live"}
                    className={`px-1.5 py-0.5 rounded-sm border-2 text-[9px] font-black uppercase tracking-widest nb-press ${STATUS_STYLE[v.status]}`}
                  >
                    {v.status === "live" ? "● Live" : "Draft"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className="text-left"
                >
                  <pre className="text-[10px] font-mono whitespace-pre-wrap leading-snug text-ink/80 max-h-20 overflow-hidden">
                    {v.body.trim() || "Empty — click to write…"}
                  </pre>
                </button>
                <div className="flex items-center gap-1 mt-auto pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicate(v)}
                    className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    Dup
                  </button>
                  <button
                    type="button"
                    onClick={() => update(v.id, { status: "archived" })}
                    className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    title="Delete variant"
                    className="ml-auto border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="mt-3 border-2 border-line bg-paper rounded-md p-3 nb-shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Editing · {selected.label}
            </div>
            <div className="flex items-center gap-1.5">
              {(["live", "draft"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update(selected.id, { status: s })}
                  className={`px-2 py-0.5 rounded-sm border-2 text-[9px] font-black uppercase tracking-widest nb-press ${
                    selected.status === s ? STATUS_STYLE[s] : "bg-background border-line text-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={selected.body}
            onChange={(e) => update(selected.id, { body: e.target.value })}
            rows={8}
            placeholder={`00:00 First line of the script.\n00:03 Next line.\n00:11 ...`}
            className="w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed font-mono"
          />
          <p className="text-[10px] text-muted mt-1">
            One line per beat — start each with a timestamp like{" "}
            <code className="font-mono">00:03</code>. The <b>live</b> variant
            renders on the public format page.
          </p>
          <AskClaude
            briefName={briefName}
            formatTitle={formatTitle}
            formatTagline={formatTagline}
            formatDescription={formatDescription}
            structure={structure}
            tips={[]}
            hooks={hooks}
            currentScript={selected.body}
            onApply={(text, mode) => {
              if (mode === "new") {
                addVariant(text);
                return;
              }
              const body =
                mode === "replace"
                  ? text
                  : `${selected.body.trim()}\n${text}`.trim();
              update(selected.id, { body });
            }}
          />
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-ink"
          >
            {showArchived ? "▾" : "▸"} Hidden ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-1.5">
              {archived.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 border-2 border-line rounded-md bg-background px-2 py-1.5 opacity-70"
                >
                  <span className="text-xs font-black uppercase tracking-wide flex-1 min-w-0 truncate">
                    {v.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      update(v.id, { status: "draft" });
                      setSelectedId(v.id);
                    }}
                    className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const COPY_PARTS: { key: string; label: string }[] = [
  { key: "pins", label: "Videos" },
  { key: "assets", label: "Assets" },
  { key: "script", label: "Script" },
  { key: "structure", label: "Structure" },
  { key: "sectionOrder", label: "Section order" },
  { key: "hiddenSections", label: "Visibility" },
];

// Small per-section copy control: a ⧉ button that opens a list of other
// formats; picking one copies just that section into the current format.
function SectionCopyButton({
  part,
  label,
  otherFormats,
  onApply,
}: {
  part: string;
  label: string;
  otherFormats: Array<{ slug: string; title: string }>;
  onApply: (sourceSlug: string, parts: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  if (otherFormats.length === 0) return null;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Copy ${label} from another format`}
        className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
      >
        ⧉ Copy
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 border-2 border-line bg-background rounded-md nb-shadow-sm min-w-[180px] max-h-[260px] overflow-y-auto">
          <div className="px-3 py-2 text-[9px] uppercase tracking-[0.2em] font-bold text-muted border-b-2 border-line">
            Copy {label} from…
          </div>
          {otherFormats.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() => {
                onApply(f.slug, [part]);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-paper border-b border-line last:border-b-0 truncate"
            >
              {f.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Per-format "copy from another format" picker: choose a source format in this
// brief + which parts to pull in (assets, order, script, structure, …).
function CopyFromFormat({
  otherFormats,
  onApply,
}: {
  otherFormats: Array<{ slug: string; title: string }>;
  onApply: (sourceSlug: string, parts: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [parts, setParts] = useState<string[]>(["assets"]);
  const [msg, setMsg] = useState<string | null>(null);

  if (otherFormats.length === 0) return null;
  const selected = source || otherFormats[0].slug;

  function toggle(key: string) {
    setParts((p) =>
      p.includes(key) ? p.filter((k) => k !== key) : [...p, key]
    );
  }

  function apply() {
    if (!selected || parts.length === 0) return;
    onApply(selected, parts);
    const name = otherFormats.find((f) => f.slug === selected)?.title ?? selected;
    setMsg(
      `Copied ${parts.length} part${parts.length === 1 ? "" : "s"} from ${name} ✓`
    );
    setTimeout(() => setMsg(null), 2500);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
      >
        ⧉ Copy from another format
      </button>
    );
  }

  return (
    <div className="mb-3 border-2 border-line bg-paper rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          ⧉ Copy from another format
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-bold text-muted hover:text-ink"
        >
          Close
        </button>
      </div>
      <label className="block">
        <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
          Source format
        </span>
        <select
          value={selected}
          onChange={(e) => setSource(e.target.value)}
          className="mt-1 w-full border-2 border-line rounded-sm px-2 py-1.5 text-sm font-bold bg-background focus:outline-none focus:border-accent"
        >
          {otherFormats.map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.title}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
          What to copy
        </span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {COPY_PARTS.map((p) => {
            const on = parts.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => toggle(p.key)}
                className={`border-2 rounded-sm px-2 py-1 text-[11px] font-bold nb-press ${
                  on
                    ? "border-line bg-accent text-accent-ink"
                    : "border-line/40 bg-background text-muted"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={parts.length === 0}
        className="w-full border-2 border-line bg-ink text-background rounded-md px-2 py-1.5 text-xs font-black uppercase tracking-widest nb-press disabled:opacity-40"
      >
        Copy into this format
      </button>
      <p className="text-[10px] text-muted">
        Overwrites the chosen parts of this format with{" "}
        {otherFormats.find((f) => f.slug === selected)?.title ?? "the source"}
        &rsquo;s. Use Reset to default to undo.
      </p>
      {msg && (
        <p className="text-[11px] font-bold border-2 border-line bg-background px-2 py-1 rounded-sm">
          {msg}
        </p>
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
  allFormats,
  onCopyPartsFrom,
  publicStatsVisible,
  publicStatsEnabled,
  onPublicStatsChange,
  defaultTitle,
  defaultTagline,
  defaultDescription,
  defaultStructure,
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
  allFormats: Array<{ slug: string; title: string }>;
  onCopyPartsFrom: (sourceSlug: string, parts: string[]) => void;
  publicStatsVisible: SectionStatKey[];
  publicStatsEnabled: boolean;
  onPublicStatsChange: (patch: { visible?: SectionStatKey[]; publicEnabled?: boolean }) => void;
  defaultTitle: string;
  defaultTagline: string;
  defaultDescription: string;
  defaultStructure: string[];
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

  // Other formats in this brief — sources for the per-section copy buttons.
  const otherFormats = allFormats.filter((f) => f.slug !== slug);

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

      <CopyFromFormat otherFormats={otherFormats} onApply={onCopyPartsFrom} />

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
          override.hiddenSections ||
          override.sectionOrder ||
          override.assets) && (
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
        <div className="flex items-center gap-1.5">
          <SectionCopyButton
            part="pins"
            label="videos"
            otherFormats={otherFormats}
            onApply={onCopyPartsFrom}
          />
          <button
            type="button"
            onClick={() => toggleSectionHidden("examples")}
            className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {isSectionHidden("examples") ? "Show videos" : "Hide videos"}
          </button>
        </div>
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
        <SectionOrderEditor
          value={override.sectionOrder}
          onChange={(next) =>
            onChangeOverride({ ...override, sectionOrder: next })
          }
          headerAction={
            <SectionCopyButton
              part="sectionOrder"
              label="section order"
              otherFormats={otherFormats}
              onApply={onCopyPartsFrom}
            />
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
          headerAction={
            <SectionCopyButton
              part="structure"
              label="structure"
              otherFormats={otherFormats}
              onApply={onCopyPartsFrom}
            />
          }
        />
        <div className={isSectionHidden("script") ? "opacity-60" : undefined}>
          <ScriptManager
            variants={normalizeVariants(override)}
            onChange={(next) =>
              onChangeOverride({
                ...override,
                scriptVariants: next.length ? next : undefined,
                script: firstLiveBody(next),
              })
            }
            isHidden={isSectionHidden("script")}
            onToggleHidden={() => toggleSectionHidden("script")}
            headerAction={
              <SectionCopyButton
                part="script"
                label="script"
                otherFormats={otherFormats}
                onApply={onCopyPartsFrom}
              />
            }
            briefName={briefName}
            formatTitle={effectiveTitle}
            formatTagline={override.tagline ?? defaultTagline}
            formatDescription={override.description ?? defaultDescription}
            structure={(override.structure ?? defaultStructure.map((t) => ({ text: t })))
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
          />
          <div className="mt-6 pt-5 border-t-2 border-line">
            <AssetManager
              assets={override.assets ?? []}
              onChange={(next) =>
                onChangeOverride({ ...override, assets: next })
              }
              headerAction={
                <SectionCopyButton
                  part="assets"
                  label="assets"
                  otherFormats={otherFormats}
                  onApply={onCopyPartsFrom}
                />
              }
            />
          </div>
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
