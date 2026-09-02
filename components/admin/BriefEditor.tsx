"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  CueHow,
  Format,
  FormatCaption,
  FormatSectionKey,
  HookCategory,
  ScriptCue,
  VideoExample,
} from "@/lib/types";
import { CUE_HOW_LABELS } from "@/lib/types";
import {
  beatKey,
  newCue,
  parseScriptLines,
  repinCue,
  resolveCues,
  totalCueSeconds,
  type ScriptLine,
} from "@/lib/script-lines";
import { FormatView } from "@/components/Views";
import {
  type ScriptVariant,
  type ScriptStatus,
  normalizeVariants,
  firstLiveBody,
  makeVariantId,
  resolveLiveScript,
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
import {
  detectSongPlatform,
  normalizeSongUrl,
  songTitleFromUrl,
  SONG_PLATFORM_LABELS,
} from "@/lib/songs";
import { formats as formatsMeta } from "@/lib/formats";
import { hookCategories as defaultHookCategories } from "@/lib/hooks";
import { STRUCTURE_PRESETS, type StructurePreset } from "@/lib/structures";
import type { RotationCreator } from "@/lib/rotation";
import { onHistoryChange, readParam, writeParams } from "@/lib/url-state";
import type { BriefOverview, BriefHookCategory, ContentCalendar, Onboarding } from "@/lib/db";
import { CalendarEditor } from "@/components/admin/CalendarEditor";
import { CollapsibleCard } from "@/components/admin/CollapsibleCard";
import { HooksEditor } from "@/components/admin/HooksEditor";
import { LogoUpload } from "@/components/admin/LogoUpload";
import { OnboardingEditor } from "@/components/admin/OnboardingEditor";
import { OverviewEditor } from "@/components/admin/OverviewEditor";
import { ProjectSources } from "@/components/admin/ProjectSources";
import { ResearchTab } from "@/components/admin/ResearchTab";
import { StudioAdmin } from "@/components/admin/StudioAdmin";
import type { StudioConfig } from "@/lib/studio";
import { VideoChip } from "@/components/admin/VideoChip";
import { VideoPicker } from "@/components/admin/VideoPicker";

// "12 minutes ago" / "3 days ago" for the recycle bin, so it is obvious
// whether something went in this session or weeks back.
function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "deleted";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

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
  songs?: FormatSongRow[];
  scriptCues?: ScriptCue[];
  caption?: FormatCaption;
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

type FormatSongRow = {
  url: string;
  altUrls?: string[];
  fileUrl?: string;
  fileMime?: string;
  title?: string;
  artist?: string;
  note?: string;
  hidden?: boolean;
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
  trashedFormats?: TrashedFormatRow[];
  // Video Builder (lib/studio.ts). Off unless studio.enabled.
  studio?: StudioConfig;
};

// A deleted script, parked whole so Restore puts back exactly what was there.
type TrashedFormatRow = {
  slug: string;
  deletedAt: string;
  title: string;
  isClone: boolean;
  cloneOf?: string;
  override?: FormatOverride;
  pins?: string[];
  bucket?: string | null;
  groupId?: string;
  orderIndex?: number;
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

type AdminTab = "scripts" | "research" | "calendar" | "studio" | "creators" | "brief";

const ADMIN_TABS: { id: AdminTab; label: string; hint: string }[] = [
  { id: "scripts", label: "Scripts", hint: "Write and assemble" },
  { id: "research", label: "Research", hint: "What is working out there" },
  { id: "calendar", label: "Calendar", hint: "Who films what, when" },
  { id: "studio", label: "Video Builder", hint: "Hook + demo stitcher" },
  { id: "creators", label: "Creators", hint: "Access and roster" },
  { id: "brief", label: "Brief setup", hint: "Settings you rarely touch" },
];

function isAdminTab(v: string | null): v is AdminTab {
  return !!v && ADMIN_TABS.some((t) => t.id === v);
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
  // Workspace tab. Scripts is the landing surface because it is the thing you
  // actually come here to do; everything else is setup you touch rarely.
  const [tab, setTab] = useState<AdminTab>("scripts");
  // Structure picker for the one-shot "new script" flow.
  const [newScriptOpen, setNewScriptOpen] = useState(false);
  // Section groups that are collapsed in the editor (by group id).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  // Scripts ticked for a bulk action. Deliberately not in the URL: a stale
  // selection restored from a shared link is a dangerous thing to hand a
  // Delete button.
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(
    new Set()
  );
  // Anchor for shift-click range selection across the grid.
  const lastTickedRef = useRef<string | null>(null);
  // Slugs from the most recent delete, so Undo is right where the action was
  // instead of requiring you to go find the bin.
  const [justDeleted, setJustDeleted] = useState<string[] | null>(null);
  // Is the recycle bin panel open in the Scripts tab?
  const [trashOpen, setTrashOpen] = useState(false);
  const [allBriefs, setAllBriefs] = useState<
    Array<{ slug: string; name: string }>
  >([]);
  // Roster, used by the calendar to show how a rotation pool would actually
  // split across the people on this brief.
  const [creators, setCreators] = useState<RotationCreator[]>([]);

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

  // Adopt whatever the URL says on mount and on back/forward. Applied in an
  // effect rather than in useState so the server and client first render agree.
  useEffect(() => {
    const sync = () => {
      const t = readParam("tab");
      setTab(isAdminTab(t) ? t : "scripts");
      setOpenSection(readParam("script"));
    };
    sync();
    return onHistoryChange(sync);
  }, []);

  function selectTab(next: AdminTab) {
    setTab(next);
    writeParams({ tab: next === "scripts" ? null : next });
  }

  // Opening a script is a destination, so it pushes: Back closes the studio.
  // Always lands on the Script panel; ?panel= is only for restoring a refresh.
  function openStudio(slug: string | null) {
    setOpenSection(slug);
    writeParams({ script: slug, panel: null }, { push: true });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/briefs/${encodeURIComponent(briefSlug)}/creators`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        const rows = (j.creators ?? []) as {
          id: string;
          name: string;
          userId: string | null;
          status: string;
        }[];
        setCreators(
          rows.map((c) => ({
            id: c.id,
            name: c.name,
            userId: c.userId ?? null,
            status: c.status,
          }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [briefSlug]);

  // Section editor modal: close on Escape + lock background scroll.
  useEffect(() => {
    if (!openSection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") openStudio(null);
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

  // Video Builder config: same debounced autosave as format overrides.
  const studioSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setAndSaveStudio(next: StudioConfig) {
    setCur((c) => {
      if (!c) return c;
      const nextCur: Curation = { ...c, studio: next };
      if (studioSaveTimer.current) clearTimeout(studioSaveTimer.current);
      studioSaveTimer.current = setTimeout(() => void persist(nextCur), 800);
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
  // `script`/`structure` ride along so the calendar can preview what a script
  // actually says before it gets scheduled — no extra fetch, the curation blob
  // is already in hand here.
  const calendarFormats = effectiveOrder
    .filter((slug) => !hiddenSet.has(slug))
    .flatMap((slug) => {
      const meta = metaFor(slug);
      if (!meta) return [];
      const ov = cur.formatOverrides?.[slug];
      const title = ov?.title ?? meta.title;
      const p = preview[slug];
      const thumbnail =
        p?.pinnedVideos?.[0]?.thumbnail ??
        p?.autoVideos?.[0]?.thumbnail ??
        meta.thumbnail;
      const script = resolveLiveScript(normalizeVariants(ov)) ?? meta.script;
      // Static meta items are plain strings; override items are objects that
      // can be individually hidden.
      const structure = (
        ov?.structure && ov.structure.length > 0
          ? ov.structure.filter((s) => !s.hidden).map((s) => s.text)
          : meta.structure.map((i) => (typeof i === "string" ? i : i.text))
      ).filter(Boolean);
      return [{ slug, title, thumbnail, script, structure }];
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
      } else if (part === "songs") {
        nextOv.songs = srcOv.songs ? srcOv.songs.map((s) => ({ ...s })) : undefined;
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
        // Cues anchor to this script's beats, so they travel with it. Copying
        // the script without them would leave the new format's shot list empty
        // while looking complete.
        nextOv.scriptCues = srcOv.scriptCues
          ? srcOv.scriptCues.map((c) => ({ ...c, id: makeVariantId() }))
          : undefined;
        overrideTouched = true;
      } else if (part === "caption") {
        nextOv.caption = srcOv.caption
          ? {
              ...srcOv.caption,
              hashtags: srcOv.caption.hashtags
                ? [...srcOv.caption.hashtags]
                : undefined,
              options: srcOv.caption.options
                ? srcOv.caption.options.map((o) => ({
                    ...o,
                    id: makeVariantId(),
                  }))
                : undefined,
            }
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

  // Remove a section. Delegates to the bulk path so a single delete and a
  // multi-select delete cannot drift apart in what they park in the bin.
  function deleteFormat(slug: string) {
    deleteFormats([slug]);
  }

  // Delete scripts by moving them to the recycle bin.
  //
  // Nothing is destroyed here: the override (title, script, cues, caption,
  // assets, sounds), the pinned video ids, the group and the position in the
  // order are all parked in `trashedFormats` so Restore can put back exactly
  // what was there. Emptying the bin is the only step that actually discards.
  //
  // Deliberately NOT a loop over a single-delete: each call would read the
  // same stale `cur` from this render, so the last write would win and every
  // earlier delete would silently come back. One pass, one persist.
  function deleteFormats(slugs: string[]) {
    if (!cur || slugs.length === 0) return;
    const doomed = new Set(slugs);
    const order = cur.formatOrder ?? effectiveOrder;
    const nextClones = { ...(cur.formatClones ?? {}) };
    const nextOverrides = { ...(cur.formatOverrides ?? {}) };
    const nextPins = { ...cur.formatPins };
    const nextBuckets = { ...cur.formatBuckets };
    const nextGroupOf = { ...(cur.sectionGroupOf ?? {}) };
    const tombstones = new Set(cur.deletedFormats ?? []);
    const deletedAt = new Date().toISOString();
    const parked: TrashedFormatRow[] = [];

    for (const slug of doomed) {
      const isClone = !!cur.formatClones?.[slug];
      const meta = metaFor(slug);
      parked.push({
        slug,
        deletedAt,
        title: cur.formatOverrides?.[slug]?.title ?? meta?.title ?? slug,
        isClone,
        cloneOf: cur.formatClones?.[slug],
        override: cur.formatOverrides?.[slug],
        pins: cur.formatPins?.[slug],
        bucket: cur.formatBuckets?.[slug],
        groupId: cur.sectionGroupOf?.[slug],
        orderIndex: order.indexOf(slug),
      });
      delete nextClones[slug];
      delete nextOverrides[slug];
      delete nextPins[slug];
      delete nextBuckets[slug];
      delete nextGroupOf[slug];
      // Clones vanish from formatClones; base formats live in code and can
      // only be suppressed with a tombstone.
      if (isClone) tombstones.delete(slug);
      else tombstones.add(slug);
    }

    const nextCur: Curation = {
      ...cur,
      formatClones: nextClones,
      formatOverrides: nextOverrides,
      formatPins: nextPins,
      formatBuckets: nextBuckets,
      sectionGroupOf: nextGroupOf,
      formatOrder: order.filter((s2) => !doomed.has(s2)),
      hiddenFormats: (cur.hiddenFormats ?? []).filter((s2) => !doomed.has(s2)),
      deletedFormats: [...tombstones],
      // Re-deleting a slug that is already in the bin replaces its entry
      // rather than stacking a second one.
      trashedFormats: [
        ...parked,
        ...(cur.trashedFormats ?? []).filter((t) => !doomed.has(t.slug)),
      ],
    };
    setCur(nextCur);
    setPreview((p) => {
      const rest = { ...p };
      for (const slug of doomed) delete rest[slug];
      return rest;
    });
    setSelectedScripts(new Set());
    lastTickedRef.current = null;
    if (openSection && doomed.has(openSection)) openStudio(null);
    // Offer an immediate undo, so getting it back does not depend on finding
    // the bin.
    setJustDeleted(parked.map((t) => t.slug));
    void persist(nextCur);
  }

  // Put trashed scripts back exactly where they were.
  function restoreFormats(slugs: string[]) {
    if (!cur || slugs.length === 0) return;
    const wanted = new Set(slugs);
    const rows = (cur.trashedFormats ?? []).filter((t) => wanted.has(t.slug));
    if (rows.length === 0) return;
    const nextClones = { ...(cur.formatClones ?? {}) };
    const nextOverrides = { ...(cur.formatOverrides ?? {}) };
    const nextPins = { ...cur.formatPins };
    const nextBuckets = { ...cur.formatBuckets };
    const nextGroupOf = { ...(cur.sectionGroupOf ?? {}) };
    const tombstones = new Set(cur.deletedFormats ?? []);
    let order = [...(cur.formatOrder ?? effectiveOrder)];

    // Low index first, so each insert lands before the ones that follow it and
    // a restored run comes back in its original relative order.
    for (const t of [...rows].sort(
      (a, b) => (a.orderIndex ?? 1e9) - (b.orderIndex ?? 1e9)
    )) {
      if (t.isClone && t.cloneOf) nextClones[t.slug] = t.cloneOf;
      if (t.override) nextOverrides[t.slug] = t.override;
      nextPins[t.slug] = t.pins ?? [];
      if (t.bucket !== undefined) nextBuckets[t.slug] = t.bucket;
      // Only re-attach the group if it still exists; otherwise it lands in
      // Ungrouped rather than pointing at a group id that was since deleted.
      if (t.groupId && (cur.sectionGroups ?? []).some((g) => g.id === t.groupId))
        nextGroupOf[t.slug] = t.groupId;
      tombstones.delete(t.slug);
      const at = t.orderIndex;
      if (at != null && at >= 0 && at <= order.length) order.splice(at, 0, t.slug);
      else order = [...order, t.slug];
    }

    const nextCur: Curation = {
      ...cur,
      formatClones: nextClones,
      formatOverrides: nextOverrides,
      formatPins: nextPins,
      formatBuckets: nextBuckets,
      sectionGroupOf: nextGroupOf,
      formatOrder: order,
      deletedFormats: [...tombstones],
      trashedFormats: (cur.trashedFormats ?? []).filter(
        (t) => !wanted.has(t.slug)
      ),
    };
    setCur(nextCur);
    setJustDeleted(null);
    // Preview holds resolved video objects, which this component cannot
    // rebuild from ids alone. Save first, then re-read so the restored tile
    // shows its real video count instead of zero.
    void (async () => {
      await persist(nextCur);
      await load();
    })();
  }

  // Empty scripts out of the bin for good. This is the destructive step, and
  // the only one.
  function purgeFormats(slugs: string[]) {
    if (!cur || slugs.length === 0) return;
    const gone = new Set(slugs);
    const nextCur: Curation = {
      ...cur,
      trashedFormats: (cur.trashedFormats ?? []).filter(
        (t) => !gone.has(t.slug)
      ),
    };
    setCur(nextCur);
    setJustDeleted(null);
    void persist(nextCur);
  }

  // Tick one tile. Shift-click extends from the last tile you ticked, walking
  // the order the grid is actually rendered in.
  //
  // The anchor is read and moved HERE, not inside the state updater. React
  // double-invokes updaters in dev StrictMode; with the ref written inside,
  // the second pass read back the slug the first pass had just stored, saw
  // `anchor === slug`, and fell through to a plain toggle. Ranges silently did
  // nothing. Updaters have to stay pure.
  function toggleScriptSelected(slug: string, extend: boolean) {
    const anchor = lastTickedRef.current;
    lastTickedRef.current = slug;
    setSelectedScripts((prev) => {
      const next = new Set(prev);
      if (extend && anchor && anchor !== slug) {
        // Ranges walk the VISIBLE order. Spanning a collapsed group would arm
        // the Delete button with scripts that are not on screen.
        const a = visibleScriptOrder.indexOf(anchor);
        const b = visibleScriptOrder.indexOf(slug);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          // The anchor's own state decides whether the run is added or cleared,
          // so shift-click can undo a range as well as make one.
          const adding = prev.has(anchor);
          for (let i = lo; i <= hi; i++) {
            if (adding) next.add(visibleScriptOrder[i]);
            else next.delete(visibleScriptOrder[i]);
          }
          return next;
        }
      }
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function setGroupSelected(slugs: string[], on: boolean) {
    setSelectedScripts((prev) => {
      const next = new Set(prev);
      for (const s of slugs) {
        if (on) next.add(s);
        else next.delete(s);
      }
      return next;
    });
  }

  function createGroup() {
    createGroupWith(null);
  }

  // Create a group and, optionally, move a script into it in the SAME update.
  // Doing it as two calls would have the second read a stale `cur` and drop
  // the group that was just added.
  function createGroupWith(slug: string | null) {
    if (!cur) return;
    const name = window.prompt("Name this group", "New group")?.trim();
    if (!name) return;
    const id = makeVariantId();
    const nextCur: Curation = {
      ...cur,
      sectionGroups: [...(cur.sectionGroups ?? []), { id, name }],
      sectionGroupOf: slug
        ? { ...(cur.sectionGroupOf ?? {}), [slug]: id }
        : cur.sectionGroupOf,
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
    openStudio(newSlug);
  }

  // One-shot creation: clone a section to get a real slug, then stamp the
  // chosen structure's beats and worked example onto it and open the studio.
  // You land in one place with the shape already filled in, instead of making
  // a blank section and then hunting for where the structure lives.
  async function createScriptFromStructure(
    name: string,
    preset: StructurePreset | null
  ) {
    if (!cur) return;
    const source = effectiveOrder[0];
    if (!source) {
      window.alert(
        "This brief has no sections yet to base a script on. Add one first."
      );
      return;
    }
    const res = await cloneSectionInBrief(source); // calls load()
    if (!res.ok || !res.newSlug) {
      window.alert(res.error ?? "Could not create the script");
      return;
    }
    const newSlug = res.newSlug;
    const override: FormatOverride = {
      title: name.trim() || preset?.name || "New script",
      tagline: preset ? `${preset.seconds}s · ${preset.name}` : "",
      // Start clean: a new script should not inherit the source's pins,
      // examples or copy, only its slug plumbing.
      structure: (preset?.beats ?? []).map((text) => ({ text })),
      scriptVariants: preset
        ? [
            {
              id: makeVariantId(),
              label: "A",
              body: preset.example,
              status: "draft" as const,
            },
          ]
        : [],
      script: undefined,
      assets: [],
      songs: [],
    };
    setAndSaveOverride(newSlug, override);
    setCur((c) => {
      if (!c) return c;
      const nextCur: Curation = {
        ...c,
        formatPins: { ...c.formatPins, [newSlug]: [] },
      };
      void persist(nextCur);
      return nextCur;
    });
    openStudio(newSlug);
  }

  // Same one-shot creation as createScriptFromStructure, but the body comes
  // from the research composer instead of a preset. Lands as variant A in
  // draft so a machine-written script cannot go live without being read.
  async function createScriptFromResearch(name: string, body: string) {
    if (!cur) return;
    const source = effectiveOrder[0];
    if (!source) {
      window.alert(
        "This brief has no sections yet to base a script on. Add one first."
      );
      return;
    }
    const res = await cloneSectionInBrief(source); // calls load()
    if (!res.ok || !res.newSlug) {
      window.alert(res.error ?? "Could not create the script");
      return;
    }
    const newSlug = res.newSlug;
    setAndSaveOverride(newSlug, {
      title: name.trim() || "Script from research",
      tagline: "",
      structure: [],
      scriptVariants: [
        {
          id: makeVariantId(),
          label: "A",
          body,
          status: "draft" as const,
        },
      ],
      script: undefined,
      assets: [],
      songs: [],
    });
    setCur((c) => {
      if (!c) return c;
      const nextCur: Curation = {
        ...c,
        formatPins: { ...c.formatPins, [newSlug]: [] },
      };
      void persist(nextCur);
      return nextCur;
    });
    openStudio(newSlug);
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

  // The order tiles actually appear on screen: each group in turn, then the
  // ungrouped remainder. Shift-click ranges walk this, not formatOrder, so a
  // dragged range matches what the eye sees.
  const scriptDisplayOrder: string[] = (() => {
    const out: string[] = [];
    for (const g of sectionGroups) {
      for (const s2 of effectiveOrder) {
        if ((cur.sectionGroupOf?.[s2] ?? "") === g.id) out.push(s2);
      }
    }
    for (const s2 of effectiveOrder) {
      const gid = cur.sectionGroupOf?.[s2] ?? "";
      if (!gid || !sectionGroups.some((g) => g.id === gid)) out.push(s2);
    }
    return out;
  })();

  // Tiles actually on screen right now: a collapsed group renders none of its
  // scripts, so neither shift-ranges nor "Select all" may reach into one.
  const visibleScriptOrder = scriptDisplayOrder.filter((s2) => {
    const gid = cur.sectionGroupOf?.[s2] ?? "";
    const g = sectionGroups.find((x) => x.id === gid);
    return !g || !collapsedGroups.has(g.id);
  });

  // A selection can outlive what it points at (a script deleted from the
  // studio, a clone removed elsewhere). Resolve against what exists now so the
  // count on the toolbar and the slugs the Delete button acts on agree.
  const selectedList = scriptDisplayOrder.filter((s2) =>
    selectedScripts.has(s2)
  );
  const selectedCount = selectedList.length;

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
    const isTicked = selectedScripts.has(slug);
    return (
      <div
        key={slug}
        // select-none: shift-clicking tiles otherwise drags a native text
        // selection across the whole grid, which smears highlight over every
        // tile in the run and looks like a rendering bug.
        className={`select-none border-2 rounded-md p-2.5 flex flex-col gap-2 ${
          isTicked
            ? "border-accent bg-paper nb-shadow-sm"
            : isOpen
              ? "border-accent bg-background nb-shadow-sm"
              : "border-line bg-background"
        } ${isHidden ? "opacity-60" : ""}`}
        onMouseDown={(e) => {
          // Chrome starts the text selection on mousedown, before any click
          // handler runs, so it has to be stopped here rather than on click.
          if (e.shiftKey) e.preventDefault();
        }}
      >
        <div className="flex items-start gap-2">
          {/* Tick to select. Shift-click extends from the last tile ticked.
              Kept separate from the title button so a normal click still opens
              the script rather than silently arming a bulk action. */}
          <label
            title="Select for bulk actions (shift-click for a range)"
            className="shrink-0 mt-0.5 cursor-pointer p-0.5 -m-0.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleScriptSelected(slug, e.shiftKey);
            }}
          >
            <input
              type="checkbox"
              checked={isTicked}
              readOnly
              tabIndex={-1}
              className="pointer-events-none align-middle"
            />
            <span className="sr-only">Select {effectiveTitle}</span>
          </label>
          <button
            type="button"
            onClick={(e) => {
              // Shift-click anywhere on the tile extends the selection, so a
              // range is two clicks. A plain click always opens the script:
              // switching the tile's meaning once something is selected would
              // make peeking at a script impossible without clearing first.
              if (e.shiftKey) {
                e.preventDefault();
                toggleScriptSelected(slug, true);
                return;
              }
              openStudio(isOpen ? null : slug);
            }}
            className="text-left flex-1 min-w-0"
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
        </div>
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
            onClick={() => openStudio(isOpen ? null : slug)}
            className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
          >
            {isOpen ? "Close" : "Edit"}
          </button>
          {/* Rename without opening the script. The studio header can also
              rename, but from the grid you are usually renaming several. */}
          <button
            type="button"
            onClick={() => {
              const next = window.prompt("Rename this script", effectiveTitle);
              if (next === null) return;
              const name = next.trim();
              if (!name || name === effectiveTitle) return;
              setAndSaveOverride(slug, { ...override, title: name });
            }}
            aria-label="Rename script"
            title="Rename this script"
            className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press flex items-center justify-center"
          >
            ✎
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
                  `Delete "${effectiveTitle}"? It moves to the bin at the bottom of the Scripts tab and can be restored.`
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

      {/* The calendar runs a grid plus a day editor side by side, so it gets
          more room than the reading-width used everywhere else. */}
      <div
        className={`mx-auto p-4 sm:p-6 space-y-4 ${
          tab === "calendar" ? "max-w-[1500px]" : "max-w-5xl"
        }`}
      >
        {/* Workspace tabs. The old build stacked every card vertically, so the
            scripts you actually work on sat below seven setup panels. */}
        <nav className="flex items-stretch gap-1.5 flex-wrap">
          {ADMIN_TABS.map((tb) => {
            const on = tab === tb.id;
            const count =
              tb.id === "scripts"
                ? effectiveOrder.length
                : tb.id === "calendar"
                  ? (cur.contentCalendar?.days?.length ?? 0)
                  : tb.id === "studio" && cur.studio?.enabled
                    ? (cur.studio.hooks?.length ?? 0)
                    : null;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => selectTab(tb.id)}
                aria-pressed={on}
                className={`border-2 border-line rounded-md px-3 py-2 text-left nb-press ${
                  on ? "bg-ink text-background" : "bg-background"
                }`}
              >
                <span className="block text-xs font-black uppercase tracking-widest">
                  {tb.label}
                  {count != null && (
                    <span className={on ? "opacity-70" : "text-muted"}>
                      {" "}
                      {count}
                    </span>
                  )}
                </span>
                <span
                  className={`block text-[10px] font-bold ${on ? "opacity-70" : "text-muted"}`}
                >
                  {tb.hint}
                </span>
              </button>
            );
          })}
        </nav>

        {tab === "brief" && (
          <>
            <CollapsibleCard
              storageKey={`brief-editor:${briefSlug}:brief-settings`}
              title="Brief settings"
            >
              <BriefSettings brief={brief} onSave={saveBrief} />
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
          </>
        )}

        {tab === "studio" && (
          <StudioAdmin
            briefSlug={briefSlug}
            config={cur.studio}
            onChange={setAndSaveStudio}
          />
        )}

        {tab === "creators" && (
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
        )}

        {tab === "research" && (
          <ResearchTab
            scopedProjectIds={cur.scopedProjectIds ?? []}
            onChangeScoped={(next) => {
              const nextCur: Curation = { ...cur, scopedProjectIds: next };
              setCur(nextCur);
              void persist(nextCur);
            }}
            onSaveScript={createScriptFromResearch}
          />
        )}

        {tab === "calendar" && (
          <>
            <label className="flex items-start gap-2 text-xs font-bold cursor-pointer border-2 border-line bg-paper rounded-md p-3">
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
              creators={creators}
              requireLogin={!!brief.requireLogin}
              onChange={setAndSaveCalendar}
              onOpenScript={openStudio}
            />
          </>
        )}

        {tab === "scripts" && (
        <>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewScriptOpen(true)}
              className="border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              + New script
            </button>
            <button
              type="button"
              onClick={createGroup}
              className="border-2 border-line bg-background px-2.5 py-1.5 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
            >
              + Group
            </button>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
            {effectiveOrder.length} scripts
          </span>
        </div>

        {/* Undo, offered immediately after a delete. The bin below is the
            durable safety net; this is the one-click version for the case you
            actually care about, which is realising straight away. */}
        {justDeleted && justDeleted.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap border-2 border-line bg-paper rounded-md nb-shadow-sm px-3 py-2">
            <span className="text-xs font-black uppercase tracking-widest">
              Deleted {justDeleted.length}{" "}
              {justDeleted.length === 1 ? "script" : "scripts"}
            </span>
            <span className="text-[10px] text-muted">
              Moved to the bin. Nothing is gone until you empty it.
            </span>
            <button
              type="button"
              onClick={() => restoreFormats(justDeleted)}
              className="ml-auto border-2 border-line bg-accent text-accent-ink px-3 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={() => setJustDeleted(null)}
              aria-label="Dismiss"
              className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bulk bar. Only exists while something is ticked, so the Delete
            button is never sitting on screen with nothing to act on. Sticky so
            it stays reachable after shift-selecting a long run. */}
        {selectedCount > 0 && (
          <div className="sticky top-[68px] z-10 flex items-center gap-2 flex-wrap border-2 border-accent bg-paper rounded-md nb-shadow-sm px-3 py-2">
            <span className="text-xs font-black uppercase tracking-widest">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedScripts(new Set(visibleScriptOrder))
              }
              disabled={
                visibleScriptOrder.length > 0 &&
                visibleScriptOrder.every((s2) => selectedScripts.has(s2))
              }
              className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Select all {visibleScriptOrder.length}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedScripts(new Set());
                lastTickedRef.current = null;
              }}
              className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              Clear
            </button>
            <span className="text-[10px] text-muted hidden sm:inline">
              Shift-click a tile to select a range.
            </span>
            <button
              type="button"
              onClick={() => {
                const names = selectedList
                  .slice(0, 8)
                  .map((s2) => {
                    const m = metaFor(s2);
                    return (
                      cur.formatOverrides?.[s2]?.title ?? m?.title ?? s2
                    );
                  });
                const more = selectedCount - names.length;
                if (
                  window.confirm(
                    `Delete ${selectedCount} ${selectedCount === 1 ? "script" : "scripts"}? They move to the bin and can be restored.\n\n` +
                      names.map((n) => `• ${n}`).join("\n") +
                      (more > 0 ? `\n…and ${more} more` : "")
                  )
                ) {
                  deleteFormats(selectedList);
                }
              }}
              className="ml-auto border-2 border-line bg-ink text-background px-3 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              🗑 Delete {selectedCount}
            </button>
          </div>
        )}

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
                {/* Tick the whole group. Indeterminate when only some of its
                    scripts are selected, so a partial state is never mistaken
                    for "all of them are about to be deleted". */}
                <input
                  type="checkbox"
                  aria-label={`Select all scripts in ${g.name}`}
                  title={`Select all ${slugs.length} in this group`}
                  disabled={slugs.length === 0}
                  checked={
                    slugs.length > 0 &&
                    slugs.every((s2) => selectedScripts.has(s2))
                  }
                  ref={(el) => {
                    if (!el) return;
                    const n = slugs.filter((s2) =>
                      selectedScripts.has(s2)
                    ).length;
                    el.indeterminate = n > 0 && n < slugs.length;
                  }}
                  onChange={(e) => setGroupSelected(slugs, e.target.checked)}
                  className="shrink-0 disabled:opacity-30"
                />
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
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <input
                    type="checkbox"
                    aria-label="Select all ungrouped scripts"
                    title={`Select all ${slugs.length} ungrouped`}
                    checked={slugs.every((s2) => selectedScripts.has(s2))}
                    ref={(el) => {
                      if (!el) return;
                      const n = slugs.filter((s2) =>
                        selectedScripts.has(s2)
                      ).length;
                      el.indeterminate = n > 0 && n < slugs.length;
                    }}
                    onChange={(e) => setGroupSelected(slugs, e.target.checked)}
                    className="shrink-0"
                  />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                    Ungrouped
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {slugs.map((slug) => renderTile(slug))}
              </div>
            </div>
          );
        })()}

        {/* Recycle bin. Collapsed by default so it never competes with the
            live scripts, but the count is always visible. */}
        {(() => {
          const trash = [...(cur.trashedFormats ?? [])].sort((a, b) =>
            b.deletedAt.localeCompare(a.deletedAt)
          );
          if (trash.length === 0) return null;
          return (
            <section className="border-2 border-line bg-background rounded-md nb-shadow-sm overflow-hidden mt-4">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-paper border-b-2 border-line">
                <button
                  type="button"
                  onClick={() => setTrashOpen((o) => !o)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span
                    className={`font-black text-base leading-none transition-transform ${trashOpen ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest">
                    🗑 Recently deleted
                  </span>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
                    {trash.length}
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => restoreFormats(trash.map((t) => t.slug))}
                    className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    ↩ Restore all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Permanently delete all ${trash.length} ${trash.length === 1 ? "script" : "scripts"} in the bin? THIS cannot be undone.`
                        )
                      )
                        purgeFormats(trash.map((t) => t.slug));
                    }}
                    className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                  >
                    Empty bin
                  </button>
                </div>
              </div>
              {trashOpen && (
                <div className="p-2.5 space-y-1.5">
                  <p className="text-[11px] text-muted">
                    Deleted scripts keep everything: script, shot list, caption,
                    sounds, pinned videos, and their place in the group. Restore
                    puts them back where they were. Only “Delete forever”
                    actually discards.
                  </p>
                  {trash.map((t) => (
                    <div
                      key={t.slug}
                      className="border-2 border-line bg-paper rounded-md p-2 flex items-center gap-2 flex-wrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black uppercase tracking-wide truncate">
                          {t.title}
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.15em] font-bold text-muted mt-0.5">
                          {relativeTime(t.deletedAt)}
                          {t.isClone ? " · COPY" : ""}
                          {(t.pins?.length ?? 0) > 0
                            ? ` · ${t.pins!.length} ${t.pins!.length === 1 ? "video" : "videos"}`
                            : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => restoreFormats([t.slug])}
                        className="shrink-0 border-2 border-line bg-accent text-accent-ink px-2 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                      >
                        ↩ Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Permanently delete "${t.title}"? THIS cannot be undone.`
                            )
                          )
                            purgeFormats([t.slug]);
                        }}
                        title="Delete forever"
                        className="shrink-0 w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })()}
        </>
        )}

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
              /* Full-page studio. This used to be a narrow centred modal, which
                 meant scrolling a single tall column to build one script. */
              <div
                className="fixed inset-0 z-50 flex flex-col bg-background"
                role="dialog"
                aria-modal="true"
              >
                <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-paper border-b-2 border-line">
                  <div className="min-w-0 flex items-center gap-3">
                    {/* Rename right here — renaming used to mean digging into
                        the Details tab. Dashed box + pencil so it reads as an
                        editable field; a bare heading was invisible as a
                        control and nobody found it. */}
                    <label
                      className="min-w-0 flex items-center gap-1.5 border-2 border-dashed border-line rounded-sm px-1.5 py-0.5 focus-within:border-solid focus-within:border-accent bg-background/60"
                      title="Rename this script"
                    >
                      <span aria-hidden className="text-[11px] text-muted shrink-0">
                        ✎
                      </span>
                      <input
                        value={effectiveTitle}
                        onChange={(e) =>
                          setAndSaveOverride(slug, {
                            ...override,
                            title: e.target.value,
                          })
                        }
                        placeholder={meta.title}
                        aria-label="Script name"
                        size={1}
                        style={{
                          width: `${Math.min(46, Math.max(10, effectiveTitle.length + 2))}ch`,
                        }}
                        className="min-w-0 max-w-full bg-transparent border-0 text-sm font-black uppercase tracking-widest focus:outline-none"
                      />
                    </label>
                    <code className="hidden sm:inline font-mono text-[10px] text-muted border-2 border-line bg-background px-1.5 py-0.5 rounded-sm shrink-0">
                      {slug}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/b/${brief.slug}/formats/${slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
                    >
                      Open live ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => openStudio(null)}
                      className="border-2 border-line bg-ink text-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {/* Manage the script's place in the brief without leaving it:
                    which group it lives in, hopping to its siblings, adding
                    another to the group, and deleting. */}
                {(() => {
                  const groupId = cur.sectionGroupOf?.[slug] ?? "";
                  const group = sectionGroups.find((g) => g.id === groupId);
                  const siblings = effectiveOrder.filter(
                    (s) => (cur.sectionGroupOf?.[s] ?? "") === groupId
                  );
                  const at = siblings.indexOf(slug);
                  const go = (delta: number) => {
                    const next = siblings[at + delta];
                    if (next) openStudio(next);
                  };
                  return (
                    <div className="shrink-0 flex items-center gap-2 flex-wrap px-4 sm:px-6 py-2 bg-background border-b-2 border-line">
                      <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
                        Group
                      </span>
                      <select
                        value={groupId}
                        onChange={(e) => {
                          if (e.target.value === "__new") {
                            createGroupWith(slug);
                            return;
                          }
                          setSectionGroup(slug, e.target.value);
                        }}
                        title="Move this script to another group"
                        className="border-2 border-line bg-background rounded-sm px-1.5 py-1 text-[11px] font-bold max-w-[220px]"
                      >
                        <option value="">Ungrouped</option>
                        {sectionGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                        <option value="__new">+ New group…</option>
                      </select>

                      <span className="w-px h-5 bg-line/40" />

                      <button
                        type="button"
                        onClick={() => go(-1)}
                        disabled={at <= 0}
                        title="Previous script in this group"
                        className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ‹
                      </button>
                      <select
                        value={slug}
                        onChange={(e) => openStudio(e.target.value)}
                        title="Jump to another script in this group"
                        className="border-2 border-line bg-background rounded-sm px-1.5 py-1 text-[11px] font-bold max-w-[260px]"
                      >
                        {siblings.map((s) => {
                          const m = metaFor(s);
                          const t =
                            cur.formatOverrides?.[s]?.title ?? m?.title ?? s;
                          return (
                            <option key={s} value={s}>
                              {t}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => go(1)}
                        disabled={at < 0 || at >= siblings.length - 1}
                        title="Next script in this group"
                        className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ›
                      </button>
                      <span className="text-[10px] font-bold text-muted">
                        {at + 1} of {siblings.length}
                        {group ? ` in ${group.name}` : " ungrouped"}
                      </span>

                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            groupId
                              ? void addScriptToGroup(groupId)
                              : void createScriptFromStructure("", null)
                          }
                          title={
                            groupId
                              ? "Add another script to this group (copies this one so you just tweak it)"
                              : "Add another script"
                          }
                          className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
                        >
                          + Script
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${effectiveTitle}"? It moves to the bin at the bottom of the Scripts tab and can be restored.`
                              )
                            ) {
                              // Step to a sibling first so the studio stays
                              // open on something real instead of blanking.
                              const nextSlug =
                                siblings[at + 1] ?? siblings[at - 1] ?? null;
                              deleteFormat(slug);
                              openStudio(nextSlug);
                            }
                          }}
                          title="Delete this script completely"
                          className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press hover:bg-[#fee2e2]"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                  <div className="max-w-6xl mx-auto">
                    <FormatSection
                    key={slug}
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

        {newScriptOpen && (
          <NewScriptModal
            onClose={() => setNewScriptOpen(false)}
            onCreate={(name, preset) => {
              setNewScriptOpen(false);
              void createScriptFromStructure(name, preset);
            }}
          />
        )}
      </div>
    </main>
  );
}

// Pick a shape, name it, done. Every preset shows its beats and a finished
// example so you can see what you are choosing before you commit to it.
function NewScriptModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, preset: StructurePreset | null) => void;
}) {
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState<string>(STRUCTURE_PRESETS[0].id);
  const preset = STRUCTURE_PRESETS.find((p) => p.id === presetId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-background border-2 border-line rounded-md nb-shadow overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-paper border-b-2 border-line">
          <span className="text-sm font-black uppercase tracking-widest">
            New script
          </span>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
              Name it
            </label>
            <input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder={preset ? preset.name : "New script"}
              className="w-full border-2 border-line bg-background px-3 py-2 rounded-md text-sm font-bold"
            />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
              Pick a structure
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STRUCTURE_PRESETS.map((p) => {
                const on = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPresetId(p.id)}
                    aria-pressed={on}
                    className={`text-left border-2 border-line rounded-md p-2.5 nb-press ${
                      on ? "bg-accent text-accent-ink" : "bg-background"
                    }`}
                  >
                    <div className="text-xs font-black">{p.name}</div>
                    <div
                      className={`text-[10px] font-bold ${on ? "opacity-80" : "text-muted"}`}
                    >
                      {p.seconds}s · {p.beats.length} beats
                    </div>
                    <div
                      className={`text-[10px] mt-1 leading-snug ${on ? "opacity-80" : "text-muted"}`}
                    >
                      {p.whenToUse}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {preset && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
                  Beats you will fill
                </div>
                <pre className="border-2 border-line bg-paper rounded-md p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {preset.beats.join("\n")}
                </pre>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
                  Example of a finished one
                </div>
                <pre className="border-2 border-line bg-paper rounded-md p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {preset.example}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-paper border-t-2 border-line">
          <span className="text-[10px] text-muted font-bold">
            Creates the script with these beats and the example as a draft
            variant, then opens it.
          </span>
          <button
            type="button"
            onClick={() => onCreate(name, preset)}
            className="border-2 border-line bg-ink text-background px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest shrink-0"
          >
            Create
          </button>
        </div>
      </div>
    </div>
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
  const [logoMsg, setLogoMsg] = useState<string | null>(null);

  // Resync only when we switch to a different brief. Keying this on the whole
  // `brief` object meant every save response reset the fields, wiping anything
  // typed in the meantime.
  useEffect(() => {
    setName(brief.name);
    setSlug(brief.slug);
    setLogoUrl(brief.logoUrl ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.slug]);

  // The logo saves itself. Everything else in this admin autosaves, so a logo
  // change that sat behind a separate "Save brief settings" button looked like
  // it had saved and then came back on reload — pressing the toolbar Save only
  // writes the curation, not the brief row.
  async function changeLogo(next: string | null) {
    setLogoUrl(next ?? "");
    setLogoMsg("Saving…");
    await onSave({ logoUrl: next });
    setLogoMsg(next ? "Logo saved ✓" : "Logo removed ✓");
    setTimeout(() => setLogoMsg(null), 2500);
  }

  const dirty = name !== brief.name || slug !== brief.slug;

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
            Logo{" "}
            <span className="text-muted/70 normal-case tracking-normal font-normal">
              {logoMsg ?? "saves as soon as you change it"}
            </span>
          </span>
          <div className="mt-1">
            <LogoUpload
              value={logoUrl || null}
              onChange={(v) => void changeLogo(v)}
            />
          </div>
        </div>
      </div>
      {dirty && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onSave({ name, slug })}
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs"
          >
            Save name + slug
          </button>
          <span className="text-[10px] font-bold text-muted">
            Unsaved. The toolbar Save does not cover these.
          </span>
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
  caption: "Caption for the post",
  examples: "Example videos",
  structure: "Shot-by-shot structure",
  hooks: "Hooks",
  songs: "Sounds to use",
  assets: "Downloadable assets",
};
const ALL_SECTION_KEYS = [
  "script",
  "caption",
  "examples",
  "structure",
  "hooks",
  "songs",
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

// Per-format sound list. A sound is just a link (usually a TikTok music page)
// plus optional labels, so creators know exactly what audio to record with.
function SongManager({
  songs,
  onChange,
  hidden,
  onToggleHidden,
  headerAction,
}: {
  songs: FormatSongRow[];
  onChange: (next: FormatSongRow[] | undefined) => void;
  hidden: boolean;
  onToggleHidden: () => void;
  headerAction?: ReactNode;
}) {
  const [pasted, setPasted] = useState("");
  const [altDraft, setAltDraft] = useState<Record<number, string>>({});
  const [audioBusy, setAudioBusy] = useState<number | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);

  function update(next: FormatSongRow[]) {
    onChange(next.length === 0 ? undefined : next);
  }

  // Optional audio file so a creator can download the track and import it,
  // instead of only being able to reach it through the platform's own library.
  async function uploadAudio(i: number, file: File) {
    setAudioErr(null);
    setAudioBusy(i);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error ?? "upload failed");
      patch(i, { fileUrl: j.url as string, fileMime: (j.mime as string) ?? file.type });
    } catch (e) {
      setAudioErr((e as Error).message);
    } finally {
      setAudioBusy(null);
    }
  }

  function addSong(rawUrl: string) {
    const url = normalizeSongUrl(rawUrl);
    if (!url) return;
    update([...songs, { url, title: songTitleFromUrl(url) || undefined }]);
    setPasted("");
  }

  function patch(i: number, p: Partial<FormatSongRow>) {
    update(songs.map((s, j) => (j === i ? { ...s, ...p } : s)));
  }

  function move(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= songs.length) return;
    const next = [...songs];
    [next[i], next[target]] = [next[target], next[i]];
    update(next);
  }

  return (
    <div className={hidden ? "opacity-60" : undefined}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Sounds to use ({songs.length})
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {headerAction}
          {hidden && (
            <span className="px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px] font-bold uppercase tracking-widest">
              HIDDEN
            </span>
          )}
          <button
            type="button"
            onClick={onToggleHidden}
            className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {hidden ? "Show sounds" : "Hide sounds"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {songs.map((s, i) => {
          const platform = detectSongPlatform(s.url);
          return (
            <div
              key={i}
              className={`border-2 border-line rounded-md p-2 space-y-1.5 ${
                s.hidden ? "bg-paper opacity-60" : "bg-background"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[9px] uppercase tracking-[0.2em] font-bold text-muted w-16">
                  {SONG_PLATFORM_LABELS[platform]}
                </span>
                <input
                  type="url"
                  value={s.url}
                  onChange={(e) => patch(i, { url: e.target.value })}
                  onBlur={(e) => {
                    const url = normalizeSongUrl(e.target.value);
                    patch(i, {
                      url,
                      title: s.title?.trim()
                        ? s.title
                        : songTitleFromUrl(url) || undefined,
                    });
                  }}
                  placeholder="https://www.tiktok.com/music/…"
                  className="flex-1 min-w-0 border-2 border-line rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent bg-background"
                />
                <a
                  href={s.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open link"
                  className="shrink-0 w-7 h-7 border-2 border-line bg-background rounded-sm nb-press flex items-center justify-center text-xs font-black"
                >
                  ↗
                </a>
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="shrink-0 w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === songs.length - 1}
                  onClick={() => move(i, 1)}
                  className="shrink-0 w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => patch(i, { hidden: !s.hidden })}
                  title={s.hidden ? "Show on public page" : "Hide from public page"}
                  className="shrink-0 w-7 h-7 border-2 border-line bg-background rounded-sm nb-press text-xs"
                >
                  {s.hidden ? "🚫" : "👁"}
                </button>
                <button
                  type="button"
                  aria-label="Remove sound"
                  onClick={() => update(songs.filter((_, j) => j !== i))}
                  className="shrink-0 w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press"
                >
                  ×
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <input
                  type="text"
                  value={s.title ?? ""}
                  onChange={(e) => patch(i, { title: e.target.value })}
                  placeholder="Sound name"
                  className="flex-1 min-w-[140px] border-2 border-line rounded-sm px-2 py-1 text-xs font-bold focus:outline-none focus:border-accent bg-background"
                />
                <input
                  type="text"
                  value={s.artist ?? ""}
                  onChange={(e) => patch(i, { artist: e.target.value })}
                  placeholder="Artist (optional)"
                  className="flex-1 min-w-[140px] border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
                />
              </div>
              {/* The same sound on other platforms. An Instagram creator
                  cannot open a TikTok sound link, so each place it lives gets
                  its own link and its own button on the public page. */}
              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted w-16 shrink-0">
                  Also on
                </span>
                {(s.altUrls ?? []).map((u, k) => (
                  <span
                    key={k}
                    className="border-2 border-line bg-paper px-1.5 py-0.5 rounded-sm text-[10px] font-bold flex items-center gap-1"
                  >
                    {SONG_PLATFORM_LABELS[detectSongPlatform(u)]}
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-ink"
                      title={u}
                    >
                      ↗
                    </a>
                    <button
                      type="button"
                      aria-label="Remove link"
                      onClick={() =>
                        patch(i, {
                          altUrls: (s.altUrls ?? []).filter((_, j2) => j2 !== k),
                        })
                      }
                      className="font-black text-muted hover:text-ink"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="url"
                  value={altDraft[i] ?? ""}
                  onChange={(e) =>
                    setAltDraft((d) => ({ ...d, [i]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const url = normalizeSongUrl(altDraft[i] ?? "");
                    if (!url) return;
                    patch(i, { altUrls: [...(s.altUrls ?? []), url] });
                    setAltDraft((d) => ({ ...d, [i]: "" }));
                  }}
                  placeholder="Same sound on Instagram / YouTube, paste + enter"
                  className="flex-1 min-w-[180px] border-2 border-dashed border-line rounded-sm px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-accent bg-background"
                />
              </div>

              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted w-16 shrink-0">
                  Audio
                </span>
                {s.fileUrl ? (
                  <>
                    <audio src={s.fileUrl} controls preload="none" className="h-8" />
                    <button
                      type="button"
                      onClick={() =>
                        patch(i, { fileUrl: undefined, fileMime: undefined })
                      }
                      className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <label className="border-2 border-dashed border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest cursor-pointer">
                    {audioBusy === i ? "Uploading…" : "+ Upload file"}
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void uploadAudio(i, f);
                      }}
                    />
                  </label>
                )}
                <span className="text-[10px] text-muted">
                  Optional. Lets them download and import it directly.
                </span>
              </div>

              <input
                type="text"
                value={s.note ?? ""}
                onChange={(e) => patch(i, { note: e.target.value })}
                placeholder="Note for creators (e.g. start at the drop, keep volume low)"
                className="w-full border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
              />
            </div>
          );
        })}
      </div>

      {audioErr && (
        <p className="text-[11px] font-bold border-2 border-line bg-paper px-2 py-1 rounded-sm mt-2">
          Audio upload failed: {audioErr}
        </p>
      )}

      <div className="flex gap-1.5 mt-2">
        <input
          type="url"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSong(pasted);
            }
          }}
          placeholder="Paste a sound link, e.g. https://www.tiktok.com/music/som-original-7448647634538580741"
          className="flex-1 min-w-0 border-2 border-dashed border-line rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-accent bg-background"
        />
        <button
          type="button"
          onClick={() => addSong(pasted)}
          disabled={!pasted.trim()}
          className="shrink-0 border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-md nb-press text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
        >
          + Add sound
        </button>
      </div>
      <p className="text-[10px] text-muted mt-1.5">
        Open the sound on TikTok, copy the link from the share sheet, paste it
        here. The name fills in automatically.
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
  // "es" pulls the app's Spanish store listing (MX) and Spanish card labels.
  const [cardLang, setCardLang] = useState<"en" | "es">("en");
  // Bible verse builder.
  const [verseOpen, setVerseOpen] = useState(false);
  const [verseRefInput, setVerseRefInput] = useState("");
  // "es" fetches Reina-Valera 1960 with Spanish book names.
  const [verseLang, setVerseLang] = useState<"en" | "es">("en");
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
      const res = await fetch(
        `/api/bible?ref=${encodeURIComponent(r)}&translation=${
          verseLang === "es" ? "rvr1960" : "web"
        }`
      );
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
        `/api/itunes-search?term=${encodeURIComponent(t)}&country=${
          cardLang === "es" ? "mx" : "us"
        }`
      );
      const j = await res.json();
      if (j.ok) setCardApps(j.apps);
    } finally {
      setCardBusy(false);
    }
  }
  function addCard(app: { id: string; name: string }) {
    const es = cardLang === "es";
    update([
      ...assets,
      {
        url: `/api/app-card?id=${app.id}&country=${es ? "mx" : "us"}${es ? "&lang=es" : ""}`,
        mime: "image/png",
        filename: `${app.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-card.png`,
        label: es ? `${app.name}, app card` : `${app.name} — app card`,
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
              placeholder="Verse reference (e.g. John 3:16, Marcos 16:15)"
              className="flex-1 border-2 border-line rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
            />
            <select
              value={verseLang}
              onChange={(e) => setVerseLang(e.target.value as "en" | "es")}
              title="Bible language"
              className="border-2 border-line rounded-sm px-1.5 py-1 text-xs font-bold bg-background focus:outline-none focus:border-accent"
            >
              <option value="en">EN · WEB</option>
              <option value="es">ES · RVR1960</option>
            </select>
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
            <select
              value={cardLang}
              onChange={(e) => {
                setCardLang(e.target.value as "en" | "es");
                setCardApps(null);
              }}
              title="Store language — ES uses the Mexican App Store (Spanish app name + reviews)"
              className="border-2 border-line rounded-sm px-1.5 py-1 text-xs font-bold bg-background focus:outline-none focus:border-accent"
            >
              <option value="en">EN · US store</option>
              <option value="es">ES · MX store</option>
            </select>
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
  example,
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
  // Another variant of this same format, handed over as the shape to match.
  example?: string;
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
          example,
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

// ---------------------------------------------------------------------------
// Shot list — pins assets / overlays / on-screen text to a beat of the live
// script. Sits directly under the writing pad so timing is set while the line
// is still on screen, instead of in a separate assets tab with no context.
//
// Cues store an anchor (the beat's timestamp, or its position when untimed)
// rather than an index into the text, so rewriting a line does not silently
// move a shot to the wrong moment. Anything that comes unpinned is shown in a
// dedicated group instead of disappearing.
// ---------------------------------------------------------------------------

const CUE_HOW_KEYS: CueHow[] = [
  "broll",
  "overlay",
  "fullscreen",
  "pip",
  "text",
  "sfx",
];

// Durations that actually get typed. "Until the next line" stays the default
// because most beats simply run to the end of the line.
const CUE_DURATIONS = [1, 1.5, 2, 3, 4, 5, 8];

// ---------------------------------------------------------------------------
// Caption editor — the copy that goes in the post, separate from the script
// that goes in the video. Alternates exist so twenty creators posting the same
// day are not all pushing a byte-identical caption.
// ---------------------------------------------------------------------------

function CaptionEditor({
  caption,
  onChange,
  hidden,
  onToggleHidden,
  headerAction,
}: {
  caption: FormatCaption | undefined;
  onChange: (next: FormatCaption | undefined) => void;
  hidden: boolean;
  onToggleHidden: () => void;
  headerAction?: ReactNode;
}) {
  const c: FormatCaption = caption ?? {};
  const options = c.options ?? [];
  const [tagDraft, setTagDraft] = useState("");

  // An all-empty caption is stored as undefined so the public page's
  // hasCaption() check keeps the section off rather than rendering a shell.
  function update(next: FormatCaption) {
    const empty =
      !next.text?.trim() &&
      !next.cta?.trim() &&
      !next.note?.trim() &&
      (next.hashtags ?? []).length === 0 &&
      (next.options ?? []).length === 0;
    onChange(empty ? undefined : next);
  }

  function addTags(raw: string) {
    const parts = raw
      .split(/[\s,]+/)
      .map((x) => x.trim().replace(/^#+/, ""))
      .filter(Boolean);
    if (parts.length === 0) return;
    const merged = [...new Set([...(c.hashtags ?? []), ...parts])];
    update({ ...c, hashtags: merged });
    setTagDraft("");
  }

  return (
    <div className={hidden ? "opacity-60" : undefined}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Caption for the post
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {headerAction}
          {hidden && (
            <span className="px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px] font-bold uppercase tracking-widest">
              HIDDEN
            </span>
          )}
          <button
            type="button"
            onClick={onToggleHidden}
            className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {hidden ? "Show caption" : "Hide caption"}
          </button>
        </div>
      </div>

      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        Main caption
      </label>
      <textarea
        value={c.text ?? ""}
        onChange={(e) => update({ ...c, text: e.target.value })}
        rows={3}
        placeholder="What they paste into the caption box when they upload."
        className="w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background mb-3"
      />

      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Alternates ({options.length})
        </label>
        <button
          type="button"
          onClick={() =>
            update({
              ...c,
              options: [
                ...options,
                { id: makeVariantId(), text: "" },
              ],
            })
          }
          className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          + Alternate
        </button>
      </div>
      <p className="text-[11px] text-muted mb-2">
        Creators pick one. Stops every account posting the identical string.
      </p>
      <div className="space-y-2 mb-3">
        {options.map((o, i) => (
          <div
            key={o.id || i}
            className="border-2 border-line bg-background rounded-md p-2 space-y-1.5"
          >
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 w-6 h-6 border-2 border-line bg-paper rounded-sm flex items-center justify-center text-[10px] font-black">
                {String.fromCharCode(65 + i)}
              </span>
              <input
                type="text"
                value={o.label ?? ""}
                onChange={(e) =>
                  update({
                    ...c,
                    options: options.map((x, j) =>
                      j === i ? { ...x, label: e.target.value || undefined } : x
                    ),
                  })
                }
                placeholder="Label (optional, e.g. 'Shorter')"
                className="flex-1 min-w-0 border-2 border-line rounded-sm px-2 py-1 text-[11px] font-bold focus:outline-none focus:border-accent bg-background"
              />
              <button
                type="button"
                aria-label="Remove alternate"
                onClick={() =>
                  update({
                    ...c,
                    options: options.filter((_, j) => j !== i),
                  })
                }
                className="shrink-0 w-6 h-6 border-2 border-line bg-background rounded-sm font-black nb-press text-xs"
              >
                ×
              </button>
            </div>
            <textarea
              value={o.text}
              onChange={(e) =>
                update({
                  ...c,
                  options: options.map((x, j) =>
                    j === i ? { ...x, text: e.target.value } : x
                  ),
                })
              }
              rows={2}
              placeholder="Alternate caption"
              className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
            />
          </div>
        ))}
      </div>

      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        Hashtags
      </label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {(c.hashtags ?? []).map((h, i) => (
          <span
            key={i}
            className="border-2 border-line bg-paper px-1.5 py-0.5 rounded-sm text-[11px] font-bold flex items-center gap-1"
          >
            #{h}
            <button
              type="button"
              aria-label={`Remove #${h}`}
              onClick={() =>
                update({
                  ...c,
                  hashtags: (c.hashtags ?? []).filter((_, j) => j !== i),
                })
              }
              className="font-black text-muted hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={tagDraft}
        onChange={(e) => setTagDraft(e.target.value)}
        onBlur={() => addTags(tagDraft)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === " ") {
            e.preventDefault();
            addTags(tagDraft);
          }
        }}
        placeholder="Type a tag and hit enter. #fyp #prayer"
        className="w-full border-2 border-line rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-accent bg-background mb-3"
      />

      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        Call to action
      </label>
      <input
        type="text"
        value={c.cta ?? ""}
        onChange={(e) => update({ ...c, cta: e.target.value })}
        placeholder="Link in bio, comment a word, follow for part 2…"
        className="w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background mb-3"
      />

      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        Note for creators
      </label>
      <input
        type="text"
        value={c.note ?? ""}
        onChange={(e) => update({ ...c, note: e.target.value })}
        placeholder="Guidance shown under the caption (this line does translate)"
        className="w-full border-2 border-line rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-accent bg-background"
      />
    </div>
  );
}

function CueEditor({
  cue,
  assets,
  onPatch,
  onRemove,
}: {
  cue: ScriptCue;
  assets: FormatAssetRow[];
  onPatch: (p: Partial<ScriptCue>) => void;
  onRemove: () => void;
}) {
  const asset = cue.assetUrl
    ? assets.find((a) => a.url === cue.assetUrl)
    : undefined;
  return (
    <div className="border-2 border-line bg-background rounded-sm p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={cue.how}
          onChange={(e) => onPatch({ how: e.target.value as CueHow })}
          className="border-2 border-line bg-background rounded-sm px-1.5 py-1 text-[11px] font-bold focus:outline-none focus:border-accent"
        >
          {CUE_HOW_KEYS.map((k) => (
            <option key={k} value={k}>
              {CUE_HOW_LABELS[k]}
            </option>
          ))}
        </select>

        <select
          value={cue.assetUrl ?? ""}
          onChange={(e) =>
            onPatch({ assetUrl: e.target.value || undefined })
          }
          className="flex-1 min-w-[140px] border-2 border-line bg-background rounded-sm px-1.5 py-1 text-[11px] focus:outline-none focus:border-accent"
        >
          <option value="">No file (direction only)</option>
          {assets.map((a, i) => (
            <option key={a.url || i} value={a.url}>
              {a.label?.trim() || a.filename || `Asset ${i + 1}`}
            </option>
          ))}
        </select>

        <select
          value={cue.durationSec ?? ""}
          onChange={(e) =>
            onPatch({
              durationSec: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          title="How long it stays on screen"
          className="border-2 border-line bg-background rounded-sm px-1.5 py-1 text-[11px] font-bold focus:outline-none focus:border-accent"
        >
          <option value="">Until next line</option>
          {CUE_DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d}s
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-label="Remove shot"
          onClick={onRemove}
          className="shrink-0 w-6 h-6 border-2 border-line bg-background rounded-sm font-black nb-press text-xs"
        >
          ×
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <input
          type="text"
          value={cue.label ?? ""}
          onChange={(e) => onPatch({ label: e.target.value || undefined })}
          placeholder={
            asset?.label?.trim() || asset?.filename || "What they see (label)"
          }
          className="flex-1 min-w-[140px] border-2 border-line rounded-sm px-2 py-1 text-[11px] font-bold focus:outline-none focus:border-accent bg-background"
        />
        <input
          type="text"
          value={cue.note ?? ""}
          onChange={(e) => onPatch({ note: e.target.value || undefined })}
          placeholder="Direction (mute it, zoom slowly, hard cut back)"
          className="flex-1 min-w-[180px] border-2 border-line rounded-sm px-2 py-1 text-[11px] focus:outline-none focus:border-accent bg-background"
        />
      </div>
    </div>
  );
}

function ShotList({
  script,
  cues,
  assets,
  onChange,
}: {
  script: string;
  cues: ScriptCue[];
  assets: FormatAssetRow[];
  onChange: (next: ScriptCue[] | undefined) => void;
}) {
  const lines = parseScriptLines(script);
  const { byIndex, orphans: stranded } = resolveCues(cues, lines);
  const total = totalCueSeconds(cues);

  function update(next: ScriptCue[]) {
    onChange(next.length === 0 ? undefined : next);
  }
  function patch(id: string, p: Partial<ScriptCue>) {
    update(cues.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }
  function remove(id: string) {
    update(cues.filter((c) => c.id !== id));
  }
  function add(line: ScriptLine, index: number) {
    update([...cues, newCue(line, index)]);
  }

  if (lines.length === 0) {
    return (
      <div className="border-2 border-dashed border-line rounded-md p-4 text-center">
        <p className="text-xs text-muted">
          Write the script first. Shots pin to its lines.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Shot list ({cues.length})
        </div>
        {total > 0 && (
          <span className="text-[10px] font-bold text-muted">
            {total}s of on-screen assets
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted">
        Pin a file, overlay or on-screen line to the moment it appears. Creators
        see it right under that line of the script.
      </p>

      <ol className="space-y-1.5">
        {lines.map((l, i) => {
          const key = beatKey(l, i);
          const mine = byIndex.get(i) ?? [];
          return (
            <li
              key={key}
              className="border-2 border-line bg-paper rounded-md p-2 space-y-1.5"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 font-mono text-[10px] font-bold border-2 border-line bg-background px-1 py-0.5 rounded-sm">
                  {l.timestamp ?? `L${i + 1}`}
                </span>
                <span className="min-w-0 flex-1 text-xs text-ink leading-snug">
                  {l.body || <em className="text-muted">(empty line)</em>}
                </span>
                <button
                  type="button"
                  onClick={() => add(l, i)}
                  className="shrink-0 border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
                >
                  + Shot
                </button>
              </div>
              {mine.map((c) => (
                <CueEditor
                  key={c.id}
                  cue={c}
                  assets={assets}
                  onPatch={(p) => patch(c.id, p)}
                  onRemove={() => remove(c.id)}
                />
              ))}
            </li>
          );
        })}
      </ol>

      {stranded.length > 0 && (
        <div className="border-2 border-line bg-background rounded-md p-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Unpinned ({stranded.length})
          </div>
          <p className="text-[11px] text-muted">
            The line these were pinned to changed. Re-pin them to a beat above,
            or delete them. Creators currently see these at the end of the
            script.
          </p>
          {stranded.map((c) => (
            <div key={c.id} className="space-y-1">
              <select
                value=""
                onChange={(e) => {
                  const i = Number(e.target.value);
                  if (!Number.isInteger(i) || !lines[i]) return;
                  update(
                    cues.map((x) =>
                      x.id === c.id ? repinCue(x, lines[i], i) : x
                    )
                  );
                }}
                className="w-full border-2 border-line bg-background rounded-sm px-1.5 py-1 text-[11px] font-bold focus:outline-none focus:border-accent"
              >
                <option value="">Re-pin to a line…</option>
                {lines.map((l, i) => (
                  <option key={beatKey(l, i)} value={i}>
                    {(l.timestamp ?? `L${i + 1}`) + ": " + l.body.slice(0, 40)}
                  </option>
                ))}
              </select>
              <CueEditor
                cue={c}
                assets={assets}
                onPatch={(p) => patch(c.id, p)}
                onRemove={() => remove(c.id)}
              />
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && (
        <p className="text-[11px] text-muted border-2 border-dashed border-line rounded-md p-2">
          No files uploaded yet. Add them in the <strong>Assets</strong> tab and
          they become pickable here.
        </p>
      )}
    </div>
  );
}

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

  // Hand Claude one of this format's other variants as the shape to match, so
  // a new variant sounds like a sibling rather than a fresh guess. Live ones
  // are preferred because they are the versions you decided were good.
  const exampleVariantBody = (() => {
    const others = variants.filter(
      (v) => v.id !== selected?.id && v.body.trim()
    );
    const live = others.find((v) => v.status === "live");
    return (live ?? others[0])?.body.trim() || undefined;
  })();

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
      {/* Variant strip. This used to be a grid of preview cards you had to
          scroll past before reaching the editor — now it is one row of pills
          so the pad is the first thing under your cursor. */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {active.map((v) => {
          const isSel = selected?.id === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              aria-pressed={isSel}
              title={v.status === "live" ? "Live variant" : "Draft variant"}
              className={`flex items-center gap-1.5 border-2 border-line rounded-sm px-2 py-1 nb-press text-[10px] font-black uppercase tracking-widest ${
                isSel ? "bg-ink text-background" : "bg-background"
              }`}
            >
              {v.status === "live" && (
                <span className={isSel ? "opacity-80" : "text-accent"}>●</span>
              )}
              <span className="max-w-[160px] truncate">{v.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => addVariant()}
          className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          + New
        </button>
        {isHidden && (
          <span className="px-1.5 py-0.5 bg-paper border-2 border-line rounded-sm text-[9px] font-black uppercase tracking-widest">
            HIDDEN
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {headerAction}
          <button
            type="button"
            onClick={onToggleHidden}
            className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {isHidden ? "Show" : "Hide section"}
          </button>
        </div>
      </div>

      {active.length === 0 && (
        <button
          type="button"
          onClick={() => addVariant()}
          className="w-full border-2 border-dashed border-line rounded-md py-16 text-sm font-bold text-muted hover:text-ink hover:border-accent nb-press"
        >
          + Start writing
        </button>
      )}

      {selected && (
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <input
              value={selected.label}
              onChange={(e) => update(selected.id, { label: e.target.value })}
              aria-label="Variant name"
              title="Name this variant"
              className="w-[150px] border-2 border-line bg-background rounded-sm px-2 py-1 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:border-accent"
            />
            {(["live", "draft"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update(selected.id, { status: s })}
                className={`px-2 py-1 rounded-sm border-2 text-[9px] font-black uppercase tracking-widest nb-press ${
                  selected.status === s
                    ? STATUS_STYLE[s]
                    : "bg-background border-line text-muted"
                }`}
              >
                {s}
              </button>
            ))}
            <span className="text-[10px] font-bold text-muted">
              {active.length} active · {liveCount} live
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => duplicate(selected)}
                className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
              >
                Dup
              </button>
              <button
                type="button"
                onClick={() => update(selected.id, { status: "archived" })}
                title="Move this variant to Hidden"
                className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
              >
                Hide
              </button>
              <button
                type="button"
                onClick={() => remove(selected.id)}
                title="Delete variant"
                className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[9px] font-black hover:bg-[#fee2e2]"
              >
                ✕
              </button>
            </div>
          </div>
          <textarea
            value={selected.body}
            onChange={(e) => update(selected.id, { body: e.target.value })}
            rows={22}
            autoFocus
            placeholder={`00:00 First line of the script.\n00:03 Next line.\n00:11 ...`}
            className="w-full min-h-[62vh] resize-y border-2 border-line rounded-md px-3 py-3 text-[15px] focus:outline-none focus:border-accent bg-background leading-[1.9] font-mono nb-shadow-sm"
          />
          <p className="text-[10px] text-muted mt-1">
            One line per beat — start each with a timestamp like{" "}
            <code className="font-mono">00:03</code>. The <b>live</b> variant
            renders on the public format page. Shot-by-shot instructions live on
            the <b>Structure</b> tab.
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
            example={exampleVariantBody}
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
  { key: "songs", label: "Sounds" },
  { key: "script", label: "Script + shots" },
  { key: "caption", label: "Caption" },
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

type StudioTab =
  | "script"
  | "caption"
  | "structure"
  | "examples"
  | "assets"
  | "sounds"
  | "hooks"
  | "details"
  | "preview";

const STUDIO_TABS: { id: StudioTab; label: string; icon: string }[] = [
  { id: "script", label: "Script", icon: "✎" },
  { id: "caption", label: "Caption", icon: "#" },
  { id: "structure", label: "Structure", icon: "◫" },
  { id: "examples", label: "Examples", icon: "▶" },
  { id: "assets", label: "Assets", icon: "⬇" },
  { id: "sounds", label: "Sounds", icon: "♪" },
  { id: "hooks", label: "Hooks", icon: "⚓" },
  { id: "details", label: "Details", icon: "⚙" },
  { id: "preview", label: "Preview", icon: "👁" },
];

// Vertical rail on desktop, horizontal scroller on mobile. Counts sit on the
// tabs so a script's gaps are visible without opening every panel.
function StudioRail({
  tab,
  onChange,
  counts,
}: {
  tab: StudioTab;
  onChange: (t: StudioTab) => void;
  counts: Partial<Record<StudioTab, number>>;
}) {
  return (
    <nav className="w-full lg:w-40 shrink-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 lg:sticky lg:top-2">
      {STUDIO_TABS.map((t) => {
        const on = t.id === tab;
        const n = counts[t.id];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={on}
            className={`shrink-0 flex items-center gap-2 border-2 border-line rounded-md px-2.5 py-2 nb-press text-left ${
              on ? "bg-ink text-background" : "bg-background"
            }`}
          >
            <span className="text-xs leading-none">{t.icon}</span>
            <span className="text-[11px] font-black uppercase tracking-widest">
              {t.label}
            </span>
            {n != null && n > 0 && (
              <span
                className={`ml-auto text-[10px] font-bold ${on ? "opacity-70" : "text-muted"}`}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// Renders the actual public component so the preview cannot drift from what
// creators get.
function CreatorPreview({
  format,
  hookCategories,
  publicStats,
}: {
  format: Format;
  hookCategories: HookCategory[];
  publicStats: { enabled: boolean; visible?: string[] };
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="border-2 border-line bg-accent text-accent-ink px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest">
          Creator view
        </span>
        <span className="text-[10px] text-muted font-bold">
          Exactly what they see on the brief page.
        </span>
      </div>
      <div className="border-2 border-line rounded-md bg-background p-4 sm:p-6 max-h-[70vh] overflow-y-auto">
        <FormatView
          format={format}
          hookCategories={hookCategories}
          publicStats={publicStats}
        />
      </div>
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
  // Which workspace panel is showing. Script first: it is the thing you came
  // here to write, everything else supports it. Mirrored into ?panel= so a
  // refresh keeps you on the panel you were using.
  const [tab, setTab] = useState<StudioTab>("script");

  useEffect(() => {
    const sync = () => {
      const p = readParam("panel");
      setTab(STUDIO_TABS.some((t) => t.id === p) ? (p as StudioTab) : "script");
    };
    sync();
    return onHistoryChange(sync);
  }, []);

  function selectPanel(next: StudioTab) {
    setTab(next);
    writeParams({ panel: next === "script" ? null : next });
  }

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

  // Counts on the rail so you can see what a script is still missing without
  // opening every tab.
  const railCounts: Partial<Record<StudioTab, number>> = {
    examples: pins.length,
    assets: (override.assets ?? []).length,
    sounds: (override.songs ?? []).length,
    script: normalizeVariants(override).length,
    structure: (override.structure ?? defaultStructure).length,
    // Shots pinned into the script, so a script with no on-screen direction
    // reads as a gap on the rail rather than looking finished.
    caption:
      (override.caption?.options ?? []).length +
      (override.caption?.text?.trim() ? 1 : 0),
  };

  // The Preview tab renders the real creator component, not a mock-up, so what
  // you see here is what ships.
  const previewFormat: Format = {
    slug,
    // bestFor/tips are not part of FormatSectionKey, so the public view never
    // renders them; empty keeps the shape valid without inventing content.
    bestFor: [],
    tips: [],
    title: effectiveTitle,
    tagline: override.tagline ?? defaultTagline,
    description: override.description ?? defaultDescription,
    script: resolveLiveScript(normalizeVariants(override)),
    structure:
      override.structure && override.structure.length > 0
        ? override.structure
        : defaultStructure.map((t) => ({ text: t })),
    examples: pinnedVideos,
    hiddenSections: (override.hiddenSections ?? []) as FormatSectionKey[],
    sectionOrder: override.sectionOrder as FormatSectionKey[] | undefined,
    assets: override.assets ?? [],
    songs: override.songs ?? [],
    scriptCues: override.scriptCues ?? [],
    caption: override.caption,
    hookCategorySlugs: linkedHookSlugs,
  };
  const previewHooks: HookCategory[] = (hookCategories ?? defaultHookCategories).map(
    (c) => ({
      slug: c.slug,
      title: c.title,
      summary: c.summary ?? "",
      whyItWorks: c.whyItWorks ?? "",
      hooks: c.hooks,
    })
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <StudioRail tab={tab} onChange={selectPanel} counts={railCounts} />
      <div className="flex-1 min-w-0 w-full">
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

      {/* Structure lives on its own tab: opening Script should drop you
          straight into the writing pad, not a wall of shot instructions. */}
      {tab === "structure" && (
        <>
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
        </>
      )}

      {tab === "script" && (
        <>
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
  </div>
          <div className="mt-4 pt-4 border-t-2 border-line">
            <ShotList
              script={resolveLiveScript(normalizeVariants(override)) ?? ""}
              cues={override.scriptCues ?? []}
              assets={override.assets ?? []}
              onChange={(next) =>
                onChangeOverride({ ...override, scriptCues: next })
              }
            />
          </div>
        </>
      )}

      {tab === "caption" && (
        <CaptionEditor
          caption={override.caption}
          onChange={(next) => onChangeOverride({ ...override, caption: next })}
          hidden={isSectionHidden("caption")}
          onToggleHidden={() => toggleSectionHidden("caption")}
          headerAction={
            <SectionCopyButton
              part="caption"
              label="caption"
              otherFormats={otherFormats}
              onApply={onCopyPartsFrom}
            />
          }
        />
      )}

      {tab === "examples" && (
        <>
        <SectionStats
          videos={pinnedVideos}
          visible={publicStatsVisible}
          publicEnabled={publicStatsEnabled}
          onChange={onPublicStatsChange}
        />

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
        </>
      )}

      {tab === "assets" && (
        <>
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
        </>
      )}

      {tab === "sounds" && (
        <>
            <SongManager
              songs={override.songs ?? []}
              onChange={(next) => onChangeOverride({ ...override, songs: next })}
              hidden={isSectionHidden("songs")}
              onToggleHidden={() => toggleSectionHidden("songs")}
              headerAction={
                <SectionCopyButton
                  part="songs"
                  label="sounds"
                  otherFormats={otherFormats}
                  onApply={onCopyPartsFrom}
                />
              }
            />
        </>
      )}

      {tab === "hooks" && (
        <>
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
        </>
      )}

      {tab === "details" && (
        <>
        <CopyFromFormat otherFormats={otherFormats} onApply={onCopyPartsFrom} />

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
            override.assets ||
            override.songs) && (
            <button
              type="button"
              onClick={() => onChangeOverride({})}
              className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent underline"
            >
              Reset to default
            </button>
          )}
        </div>

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
        </>
      )}

      {tab === "preview" && (
        <CreatorPreview
          format={previewFormat}
          hookCategories={previewHooks}
          publicStats={{ enabled: publicStatsEnabled, visible: publicStatsVisible }}
        />
      )}
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
