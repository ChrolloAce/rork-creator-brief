"use client";

import { useEffect, useMemo, useState } from "react";
import { thumbSrc } from "@/lib/thumb";
import { RichText } from "@/components/RichText";
import type {
  CalendarAssignment,
  CalendarDay,
  CalendarGroup,
  CalendarGroupItem,
  ContentCalendar,
} from "@/lib/db";
import { distribution, optionsOf, type RotationCreator } from "@/lib/rotation";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type FormatOption = {
  slug: string;
  title: string;
  thumbnail?: string;
  // Read-only copies used by the preview popup so you can check what a script
  // says before putting it on a day.
  script?: string;
  structure?: string[];
};

function genId(): string {
  return `ca_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseISODate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function prettyDate(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso || "No date";
  return `${WEEKDAYS[mondayIndex(d)]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const EMPTY: ContentCalendar = { enabled: false, days: [] };

// Small thumbnail/initial used in the picker and day cells. `fluid` drops the
// fixed size and fills the parent's width as a square instead — what the
// picker grid needs so tiles stay flush at any column width.
function FormatThumb({
  fmt,
  size = 40,
  fluid = false,
}: {
  fmt: FormatOption | undefined;
  size?: number;
  fluid?: boolean;
}) {
  const dim = fluid
    ? { width: "100%", aspectRatio: "1 / 1" }
    : { width: size, height: size };
  if (fmt?.thumbnail) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={thumbSrc(fmt.thumbnail)}
        alt=""
        style={dim}
        className="object-cover border-2 border-line rounded-sm bg-paper shrink-0"
      />
    );
  }
  const initials = (fmt?.title ?? "?").slice(0, 2).toUpperCase();
  return (
    <span
      style={dim}
      className={`shrink-0 border-2 border-line rounded-sm bg-accent text-accent-ink flex items-center justify-center font-black ${
        fluid ? "text-sm" : "text-[11px]"
      }`}
    >
      {initials}
    </span>
  );
}

// Read-only look at what a script actually says, opened from the picker so a
// day gets filled with the right script rather than the right-looking
// thumbnail. Scripts are authored in a WYSIWYG, so the body goes through
// RichText — same renderer creators see — instead of being dumped as raw HTML.
function ScriptPreviewModal({
  fmt,
  dateLabel,
  alreadyOnDay,
  onAdd,
  onEdit,
  onClose,
}: {
  fmt: FormatOption;
  dateLabel: string;
  alreadyOnDay: boolean;
  onAdd: () => void;
  onEdit?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const script = (fmt.script ?? "").trim();
  const structure = (fmt.structure ?? []).filter((s) => s.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-background border-2 border-line rounded-md nb-shadow overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-3 bg-paper border-b-2 border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <FormatThumb fmt={fmt} size={40} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                Script preview
              </div>
              <div className="font-black leading-tight truncate">
                {fmt.title}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {script ? (
            <RichText html={script} />
          ) : structure.length > 0 ? (
            <>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                No script written — structure only
              </div>
              <ol className="list-decimal pl-5 space-y-1.5 text-sm">
                {structure.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-muted">
              This one has no script or structure yet.
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap px-4 py-3 bg-paper border-t-2 border-line">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="border-2 border-line bg-background px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              ✎ Edit script
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {alreadyOnDay && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Already on this day
              </span>
            )}
            <button
              type="button"
              onClick={onAdd}
              className="border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              + Add to {dateLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarEditor({
  value,
  formats,
  scriptGroups = [],
  creators = [],
  requireLogin = true,
  onChange,
  onOpenScript,
}: {
  value: ContentCalendar | undefined;
  formats: FormatOption[];
  // Editor "script groups" (same script, different CTA) the calendar can
  // alternate one-per-day across a date range.
  scriptGroups?: { id: string; name: string; slugs: string[] }[];
  // Roster, used to preview how a rotation pool splits across real people.
  creators?: RotationCreator[];
  // Rotation seeds on the login account id, so a code-only brief cannot vary
  // by person. Surfaced in the UI rather than failing quietly.
  requireLogin?: boolean;
  onChange: (next: ContentCalendar | undefined) => void;
  // Hands a slug back to the studio overlay so a preview can turn into an
  // edit without leaving the calendar.
  onOpenScript?: (slug: string) => void;
}) {
  const cal = value ?? EMPTY;
  const fmtBySlug = useMemo(() => {
    const m = new Map<string, FormatOption>();
    for (const f of formats) m.set(f.slug, f);
    return m;
  }, [formats]);

  const dayByDate = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of cal.days) if (d.date) m.set(d.date, d);
    return m;
  }, [cal.days]);

  const scheduled = useMemo(
    () =>
      [...dayByDate.keys()]
        .filter((iso) => (dayByDate.get(iso)?.assignments.length ?? 0) > 0)
        .sort(),
    [dayByDate]
  );

  const first = scheduled[0] ? parseISODate(scheduled[0]) : null;
  const today = new Date();
  const initial = first ?? today;
  const [view, setView] = useState({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });
  const [selected, setSelected] = useState<string>(
    scheduled[0] ?? toISODate(today)
  );
  const [showFill, setShowFill] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  // Which script group the add-a-script grid is showing. "" = all.
  const [groupFilter, setGroupFilter] = useState("");
  // Free-text filter over the same grid. Matches title and slug.
  const [pickerQuery, setPickerQuery] = useState("");
  // Slug whose script is open in the preview popup. null = closed.
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  // Chips for the strip: All, then each group that actually has scripts, then
  // Ungrouped when there are any. Counts come off the real format list so a
  // chip never promises tiles it cannot show.
  const groupFilters = useMemo(() => {
    const known = new Set(formats.map((f) => f.slug));
    const grouped = new Set<string>();
    const chips: { id: string; name: string; count: number }[] = [
      { id: "", name: "All", count: formats.length },
    ];
    for (const g of scriptGroups) {
      const slugs = g.slugs.filter((s) => known.has(s));
      slugs.forEach((s) => grouped.add(s));
      if (slugs.length > 0) {
        chips.push({ id: g.id, name: g.name, count: slugs.length });
      }
    }
    const ungrouped = formats.filter((f) => !grouped.has(f.slug)).length;
    if (ungrouped > 0 && chips.length > 1) {
      chips.push({ id: "__ungrouped", name: "Ungrouped", count: ungrouped });
    }
    return chips;
  }, [formats, scriptGroups]);

  const groupedFormats = useMemo(() => {
    if (!groupFilter) return formats;
    if (groupFilter === "__ungrouped") {
      const grouped = new Set(scriptGroups.flatMap((g) => g.slugs));
      return formats.filter((f) => !grouped.has(f.slug));
    }
    const g = scriptGroups.find((x) => x.id === groupFilter);
    if (!g) return formats;
    const slugs = new Set(g.slugs);
    return formats.filter((f) => slugs.has(f.slug));
  }, [formats, scriptGroups, groupFilter]);

  // Search runs on top of the group filter — every word has to appear
  // somewhere in the title or slug, so "devil scroll" finds the one script
  // without needing the exact phrasing.
  const visibleFormats = useMemo(() => {
    const terms = pickerQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return groupedFormats;
    return groupedFormats.filter((f) => {
      const hay = `${f.title} ${f.slug}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [groupedFormats, pickerQuery]);

  function update(patch: Partial<ContentCalendar>) {
    onChange({ ...cal, ...patch });
  }

  // Write a day's assignments; prune the day entirely when it goes empty so we
  // never leave phantom empty days behind.
  function setDayAssignments(date: string, assignments: CalendarAssignment[]) {
    const others = cal.days.filter((d) => d.date !== date);
    const days =
      assignments.length === 0
        ? others
        : [...others, { date, assignments }];
    update({ days });
  }

  const selDay = dayByDate.get(selected);
  const selAssignments = selDay?.assignments ?? [];
  const previewFmt = previewSlug ? fmtBySlug.get(previewSlug) : undefined;

  function addToSelected(a: CalendarAssignment) {
    setDayAssignments(selected, [...selAssignments, a]);
  }
  function patchAssignment(idx: number, patch: Partial<CalendarAssignment>) {
    setDayAssignments(
      selected,
      selAssignments.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    );
  }
  function removeAssignment(idx: number) {
    setDayAssignments(
      selected,
      selAssignments.filter((_, i) => i !== idx)
    );
  }

  // Month grid cells (Monday-first), with leading blanks.
  const cells = useMemo(() => {
    const f = new Date(view.year, view.month, 1);
    const lead = mondayIndex(f);
    const total = new Date(view.year, view.month + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= total; d++)
      out.push(toISODate(new Date(view.year, view.month, d)));
    return out;
  }, [view]);

  function step(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return {
        year: v.year + Math.floor(m / 12),
        month: ((m % 12) + 12) % 12,
      };
    });
  }

  const todayISO = toISODate(today);
  const totalScripts = cal.days.reduce((n, d) => n + d.assignments.length, 0);

  return (
    <div className="space-y-4">
      {/* Enable toggle — big neobrutalist switch */}
      <button
        type="button"
        onClick={() => update({ enabled: !cal.enabled })}
        className={`w-full flex items-center justify-between gap-3 border-2 border-line rounded-md px-3 py-2.5 nb-press ${
          cal.enabled ? "bg-accent text-accent-ink" : "bg-background"
        }`}
      >
        <span className="text-sm font-black uppercase tracking-widest">
          {cal.enabled ? "● Live on public brief" : "○ Hidden — tap to publish"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
          {cal.days.length}d · {totalScripts} scripts
        </span>
      </button>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={cal.title ?? ""}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Title — e.g. What to film, and when"
          className="w-full border-2 border-line rounded-md px-2 py-1.5 font-bold focus:outline-none focus:border-accent bg-background"
        />
        <input
          type="text"
          value={cal.intro ?? ""}
          onChange={(e) => update({ intro: e.target.value })}
          placeholder="Short intro (optional)"
          className="w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
      </div>

      {/* Grid and the day you are editing sit side by side on wide screens;
          before this you had to scroll past the whole month to reach the
          day editor every time you clicked a date. */}
      <div className="grid grid-cols-1 gap-4 items-start xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* Month grid */}
        <div className="min-w-0 border-2 border-line bg-background rounded-md p-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="font-black text-base">
            {MONTHS[view.month]} {view.year}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous month"
              className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setView({ year: today.getFullYear(), month: today.getMonth() })
              }
              className="border-2 border-line bg-background px-2 h-8 rounded-sm font-black nb-press text-[10px] uppercase tracking-widest"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next month"
              className="w-8 h-8 border-2 border-line bg-background rounded-sm font-black nb-press"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[9px] uppercase tracking-[0.1em] font-bold text-muted"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b-${i}`} aria-hidden />;
            const day = dayByDate.get(iso);
            const count = day?.assignments.length ?? 0;
            const isSel = selected === iso;
            const isToday = iso === todayISO;
            const thumbs = (day?.assignments ?? [])
              .slice(0, 3)
              .map((a) => (a.formatSlug ? fmtBySlug.get(a.formatSlug) : undefined));
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-pressed={isSel}
                className={`min-h-[56px] border-2 rounded-md p-1 text-left flex flex-col gap-1 nb-press ${
                  isSel
                    ? "border-line bg-accent text-accent-ink nb-shadow-sm"
                    : count > 0
                      ? "border-line bg-paper"
                      : "border-line/40 bg-background"
                }`}
              >
                <span
                  className={`text-[11px] font-black leading-none ${
                    isToday && !isSel ? "text-accent" : ""
                  }`}
                >
                  {Number(iso.slice(8, 10))}
                </span>
                {count > 0 && (
                  <span className="flex items-center gap-0.5 mt-auto flex-wrap">
                    {thumbs.map((t, j) => (
                      <FormatThumb key={j} fmt={t} size={14} />
                    ))}
                    {count > 3 && (
                      <span className="text-[9px] font-black">+{count - 3}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {cal.days.length > 0 && (
          <div className="flex justify-end mt-3 pt-3 border-t-2 border-line">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Clear the whole calendar? This removes all ${cal.days.length} scheduled ${cal.days.length === 1 ? "day" : "days"}. Your groups are kept.`
                  )
                ) {
                  update({ days: [] });
                }
              }}
              className="border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest text-[#b91c1c] hover:bg-[#fee2e2]"
            >
              🗑 Clear calendar
            </button>
          </div>
        )}
      </div>

      {/* Selected day editor */}
        <div className="min-w-0 border-2 border-line bg-paper rounded-md p-3 space-y-3 xl:sticky xl:top-2 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-black">{prettyDate(selected)}</div>
          <input
            type="date"
            value={selected}
            onChange={(e) => e.target.value && setSelected(e.target.value)}
            className="border-2 border-line rounded-sm px-2 py-1 text-xs font-bold focus:outline-none focus:border-accent bg-background"
          />
        </div>

        {/* Thumbnail picker — tap a format to add it to this day. A wrapping
            grid rather than a one-row strip: with 45 scripts the strip hid
            everything past the fourth tile behind a sideways scroll. Search +
            group filter narrow it; the grid itself scrolls vertically so the
            day's assignments stay in view underneath. */}
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Tap to preview · + to add
            </div>
            <span className="text-[10px] font-bold text-muted">
              {visibleFormats.length} of {formats.length}
            </span>
          </div>

          <div className="relative mb-2">
            <input
              /* `text`, not `search` — Chrome adds its own clear "×" to search
                 inputs, which sat on top of ours. */
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search scripts…"
              aria-label="Search scripts"
              className="w-full border-2 border-line bg-background rounded-sm pl-7 pr-7 py-1.5 text-xs font-bold focus:outline-none focus:border-accent"
            />
            <span
              aria-hidden
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none"
            >
              🔍
            </span>
            {pickerQuery && (
              <button
                type="button"
                onClick={() => setPickerQuery("")}
                title="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-black text-muted hover:text-accent leading-none px-1"
              >
                ×
              </button>
            )}
          </div>

          {/* A dropdown rather than chips: group names are long enough that
              chips wrapped into several rows in this narrow column. */}
          {groupFilters.length > 1 && (
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              title="Show only scripts from one group"
              className="w-full mb-2 border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
            >
              {groupFilters.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.count})
                </option>
              ))}
            </select>
          )}

          {visibleFormats.length === 0 ? (
            <p className="text-xs text-muted py-2">
              No scripts match “{pickerQuery}”.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-2 max-h-[19rem] overflow-y-auto pr-0.5">
              {visibleFormats.map((f) => (
                <div key={f.slug} className="relative">
                  <button
                    type="button"
                    onClick={() => setPreviewSlug(f.slug)}
                    title={`Preview ${f.title}`}
                    className="w-full border-2 border-line bg-background rounded-md overflow-hidden nb-press text-left hover:border-accent"
                  >
                    <span className="block">
                      <FormatThumb fmt={f} fluid />
                    </span>
                    {/* No `block` here — it would beat line-clamp's display and
                        let long titles run to four ragged lines. */}
                    <span className="px-1 py-1 text-[9px] font-bold leading-tight line-clamp-2">
                      {f.title}
                    </span>
                  </button>
                  {/* Quick-add stays on the tile so filling a day in bulk is
                      still one click per script when you already know it. */}
                  <button
                    type="button"
                    onClick={() =>
                      addToSelected({ id: genId(), formatSlug: f.slug })
                    }
                    title={`Add ${f.title} without previewing`}
                    aria-label={`Add ${f.title}`}
                    className="absolute top-1 right-1 w-5 h-5 border-2 border-line bg-accent text-accent-ink rounded-sm text-[11px] font-black leading-none flex items-center justify-center nb-press"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => addToSelected({ id: genId() })}
            title="Add a custom script"
            className="w-full mt-2 border-2 border-dashed border-line bg-background rounded-md nb-press flex items-center justify-center gap-1.5 py-1.5 text-muted hover:text-accent hover:border-accent"
          >
            <span className="text-base font-black leading-none">+</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Custom script
            </span>
          </button>
        </div>

        {/* This day's assignments */}
        {selAssignments.length === 0 ? (
          <p className="text-xs text-muted">
            Nothing scheduled — tap a tile above to read a script, or its ⊕ to
            add it straight to this day.
          </p>
        ) : (
          <div className="space-y-2">
            {selAssignments.map((a, idx) => {
              const isCustom = a.formatSlug === undefined;
              const fmt = a.formatSlug ? fmtBySlug.get(a.formatSlug) : undefined;
              return (
                <div
                  key={a.id}
                  className="border-2 border-line bg-background rounded-md p-2 flex gap-2"
                >
                  {/* The thumb and title of a scheduled row open the same
                      preview — checking what you already booked shouldn't mean
                      hunting it back down in the picker. */}
                  {!isCustom && (
                    <button
                      type="button"
                      onClick={() => a.formatSlug && setPreviewSlug(a.formatSlug)}
                      title={`Preview ${fmt?.title ?? a.formatSlug}`}
                      className="shrink-0 nb-press"
                    >
                      <FormatThumb fmt={fmt} size={44} />
                    </button>
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={a.label ?? ""}
                        onChange={(e) =>
                          patchAssignment(idx, { label: e.target.value })
                        }
                        placeholder="B1"
                        className="w-12 border-2 border-line rounded-sm px-1 py-1 text-xs font-black text-center uppercase tracking-widest focus:outline-none focus:border-accent bg-paper shrink-0"
                      />
                      {!isCustom && (
                        <button
                          type="button"
                          onClick={() =>
                            a.formatSlug && setPreviewSlug(a.formatSlug)
                          }
                          title="Preview this script"
                          className="font-bold text-sm leading-tight truncate text-left hover:text-accent hover:underline decoration-2 underline-offset-2"
                        >
                          {fmt?.title ?? a.formatSlug}
                        </button>
                      )}
                    </div>
                    {isCustom && (
                      <>
                        <input
                          type="text"
                          value={a.title ?? ""}
                          onChange={(e) =>
                            patchAssignment(idx, { title: e.target.value })
                          }
                          placeholder="Custom script title"
                          className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
                        />
                        <textarea
                          value={a.script ?? ""}
                          onChange={(e) =>
                            patchAssignment(idx, { script: e.target.value })
                          }
                          rows={3}
                          placeholder={"0–2s: Hook…\n2–10s: Setup…"}
                          className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background font-mono leading-relaxed"
                        />
                      </>
                    )}
                    <input
                      type="text"
                      value={a.note ?? ""}
                      onChange={(e) =>
                        patchAssignment(idx, { note: e.target.value })
                      }
                      placeholder="Note — e.g. use the 'someone showed me' hook"
                      className="w-full border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
                    />

                    <RotationPool
                      assignment={a}
                      formats={formats}
                      fmtBySlug={fmtBySlug}
                      creators={creators}
                      requireLogin={requireLogin}
                      date={selected}
                      onChange={(pool) => patchAssignment(idx, { pool })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAssignment(idx)}
                    aria-label="Remove script"
                    className="self-start w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press shrink-0"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </div>
      {/* Groups (B1, B2, B3…) */}
      <div className="border-2 border-line bg-background rounded-md">
        <button
          type="button"
          onClick={() => setShowGroups((s) => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold text-muted"
        >
          <span>🗂 Groups · B1 B2 B3 ({(cal.groups ?? []).length})</span>
          <span>{showGroups ? "−" : "+"}</span>
        </button>
        {showGroups && (
          <div className="px-3 pb-3 border-t-2 border-line pt-3">
            <GroupsManager
              groups={cal.groups ?? []}
              formats={formats}
              onChange={(groups) => update({ groups })}
            />
          </div>
        )}
      </div>

      {/* Auto-fill scheduler */}
      <div className="border-2 border-line bg-background rounded-md">
        <button
          type="button"
          onClick={() => setShowFill((s) => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold text-muted"
        >
          <span>⚡ Auto-fill a schedule</span>
          <span>{showFill ? "−" : "+"}</span>
        </button>
        {showFill && (
          <div className="px-3 pb-3 border-t-2 border-line pt-3">
            <AutoFill
              formats={formats}
              groups={cal.groups ?? []}
              scriptGroups={scriptGroups}
              defaultStart={selected}
              onGenerate={(newDays) => {
                // Merge generated assignments into existing days.
                const map = new Map<string, CalendarAssignment[]>();
                for (const d of cal.days) map.set(d.date, [...d.assignments]);
                for (const d of newDays) {
                  const arr = map.get(d.date) ?? [];
                  arr.push(...d.assignments);
                  map.set(d.date, arr);
                }
                const days: CalendarDay[] = [...map.entries()].map(
                  ([date, assignments]) => ({ date, assignments })
                );
                update({ days });
                if (newDays[0]) {
                  setSelected(newDays[0].date);
                  const d = parseISODate(newDays[0].date);
                  if (d) setView({ year: d.getFullYear(), month: d.getMonth() });
                }
                setShowFill(false);
              }}
            />
          </div>
        )}
      </div>

      {previewFmt && (
        <ScriptPreviewModal
          fmt={previewFmt}
          dateLabel={prettyDate(selected)}
          alreadyOnDay={selAssignments.some(
            (a) => a.formatSlug === previewFmt.slug
          )}
          onAdd={() => {
            addToSelected({ id: genId(), formatSlug: previewFmt.slug });
            setPreviewSlug(null);
          }}
          onEdit={
            onOpenScript
              ? () => {
                  setPreviewSlug(null);
                  onOpenScript(previewFmt.slug);
                }
              : undefined
          }
          onClose={() => setPreviewSlug(null)}
        />
      )}
    </div>
  );
}

type Cadence = "daily" | "weekdays" | "alt" | "weekly";
const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  alt: "Every 2 days",
  weekly: "Weekly",
};

// Random group index for shuffle, avoiding an immediate repeat. Module-level
// so the impure Math.random call isn't inside a component body.
// Alternatives for one slot. With a pool set, each creator is handed one of
// [the assignment, ...pool] deterministically, so the same day produces
// different work for different people without you scheduling per person.
function RotationPool({
  assignment,
  formats,
  fmtBySlug,
  creators,
  requireLogin,
  date,
  onChange,
}: {
  assignment: CalendarAssignment;
  formats: FormatOption[];
  fmtBySlug: Map<string, FormatOption>;
  creators: RotationCreator[];
  requireLogin: boolean;
  date: string;
  onChange: (pool: NonNullable<CalendarAssignment["pool"]>) => void;
}) {
  const [open, setOpen] = useState(false);
  const pool = assignment.pool ?? [];
  const options = optionsOf(assignment);

  // Only creators with a login account can be told apart, so only they can be
  // rotated. Everyone else falls back to the first option.
  const rotatable = creators.filter((c) => c.userId);
  const split = distribution(
    assignment,
    rotatable.map((c) => c.userId as string),
    date
  );

  function label(i: number): string {
    const o = options[i];
    if (o.formatSlug) return fmtBySlug.get(o.formatSlug)?.title ?? o.formatSlug;
    return o.title?.trim() || "Custom script";
  }

  if (!open && pool.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent"
      >
        + Give creators different versions
      </button>
    );
  }

  return (
    <div className="border-2 border-line bg-paper rounded-sm p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Rotation · {options.length}{" "}
          {options.length === 1 ? "version" : "versions"}
        </span>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent"
        >
          {open ? "Hide" : "Edit"}
        </button>
      </div>

      {open && (
        <>
          <div className="space-y-1.5">
            {/* Option 1 is the assignment itself, edited above. */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-5 shrink-0 font-black text-center">1</span>
              <span className="flex-1 min-w-0 truncate font-bold">
                {label(0)}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-muted shrink-0">
                Default
              </span>
            </div>

            {pool.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 font-black text-center text-[11px]">
                  {i + 2}
                </span>
                <select
                  value={p.formatSlug ?? ""}
                  onChange={(e) => {
                    const next = [...pool];
                    next[i] = e.target.value
                      ? { formatSlug: e.target.value }
                      : { title: "", script: "" };
                    onChange(next);
                  }}
                  className="flex-1 min-w-0 border-2 border-line rounded-sm px-1.5 py-1 text-[11px] font-bold bg-background"
                >
                  <option value="">Custom script…</option>
                  {formats.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onChange(pool.filter((_, j) => j !== i))}
                  aria-label="Remove version"
                  className="w-6 h-6 border-2 border-line bg-background rounded-sm font-black text-[11px] shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {pool.some((p) => !p.formatSlug) && (
            <div className="space-y-1.5">
              {pool.map((p, i) =>
                p.formatSlug ? null : (
                  <textarea
                    key={`c${i}`}
                    value={p.script ?? ""}
                    onChange={(e) => {
                      const next = [...pool];
                      next[i] = { ...next[i], script: e.target.value };
                      onChange(next);
                    }}
                    rows={2}
                    placeholder={`Version ${i + 2} script…`}
                    className="w-full border-2 border-line rounded-sm px-2 py-1 text-[11px] bg-background font-mono leading-relaxed"
                  />
                )
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              onChange([...pool, { formatSlug: formats[0]?.slug }])
            }
            className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            + Version
          </button>

          {/* The actual split, computed with the same function the public page
              uses, so this is the real answer rather than an estimate. */}
          {options.length > 1 && (
            <div className="border-t-2 border-line pt-2 space-y-1">
              {!requireLogin ? (
                <p className="text-[10px] font-bold text-[#b91c1c] leading-snug">
                  This brief does not require creator logins, so everyone is
                  anonymous and will all get version 1. Turn on “Require login”
                  in Creators to make rotation work.
                </p>
              ) : rotatable.length === 0 ? (
                <p className="text-[10px] font-bold text-muted leading-snug">
                  No creators with accounts yet. Once they log in, this shows
                  exactly who gets which version.
                </p>
              ) : (
                <>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-muted">
                    Split across {rotatable.length}{" "}
                    {rotatable.length === 1 ? "creator" : "creators"} on {date}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {split.map((n, i) => (
                      <span
                        key={i}
                        className="border-2 border-line bg-background px-1.5 py-0.5 rounded-sm text-[10px] font-bold"
                      >
                        v{i + 1}: {n}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function randomIndex(n: number, avoid: number): number {
  let idx = Math.floor(Math.random() * n);
  if (n > 1 && idx === avoid) idx = (idx + 1) % n;
  return idx;
}

function itemToAssignment(it: CalendarGroupItem): CalendarAssignment {
  return {
    id: genId(),
    formatSlug: it.formatSlug,
    title: it.title,
    script: it.script,
    note: it.note,
    label: it.label,
  };
}

function AutoFill({
  formats,
  groups,
  scriptGroups,
  defaultStart,
  onGenerate,
}: {
  formats: FormatOption[];
  groups: CalendarGroup[];
  scriptGroups: { id: string; name: string; slugs: string[] }[];
  defaultStart: string;
  onGenerate: (days: CalendarDay[]) => void;
}) {
  const usableGroups = groups.filter((g) => g.items.length > 0);
  const usableScriptGroups = scriptGroups.filter((g) => g.slugs.length > 0);
  const [source, setSource] = useState<"scriptGroup" | "group" | "formats">(
    usableScriptGroups.length > 0
      ? "scriptGroup"
      : usableGroups.length > 0
        ? "group"
        : "formats"
  );
  const [pickedScriptGroup, setPickedScriptGroup] = useState<string>(
    usableScriptGroups[0]?.id ?? ""
  );
  const chosenScriptGroup =
    usableScriptGroups.find((g) => g.id === pickedScriptGroup) ?? null;
  const fmtTitle = (slug: string) =>
    formats.find((f) => f.slug === slug)?.title ?? slug;
  const [start, setStart] = useState(defaultStart);
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [count, setCount] = useState(7);
  const [picked, setPicked] = useState<string[]>(
    formats[0] ? [formats[0].slug] : []
  );
  // Which groups participate in the alternation, and how days pick among them.
  const [pickedGroups, setPickedGroups] = useState<string[]>(
    usableGroups.map((g) => g.id)
  );
  const [distribution, setDistribution] = useState<"shuffle" | "rotate">(
    "shuffle"
  );

  const chosenGroups = usableGroups.filter((g) => pickedGroups.includes(g.id));

  function toggleFmt(slug: string) {
    setPicked((p) =>
      p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]
    );
  }
  function toggleGroup(id: string) {
    setPickedGroups((p) =>
      p.includes(id) ? p.filter((g) => g !== id) : [...p, id]
    );
  }

  function nextDate(d: Date): Date {
    const n = new Date(d.getTime());
    if (cadence === "daily") n.setDate(n.getDate() + 1);
    else if (cadence === "alt") n.setDate(n.getDate() + 2);
    else if (cadence === "weekly") n.setDate(n.getDate() + 7);
    else {
      do {
        n.setDate(n.getDate() + 1);
      } while (n.getDay() === 0 || n.getDay() === 6);
    }
    return n;
  }

  function generate() {
    const startDate = parseISODate(start);
    if (!startDate || count < 1) return;
    if (source === "group" && chosenGroups.length === 0) return;
    if (source === "formats" && picked.length === 0) return;
    if (
      source === "scriptGroup" &&
      (!chosenScriptGroup || chosenScriptGroup.slugs.length === 0)
    )
      return;
    const days: CalendarDay[] = [];
    let cursor = startDate;
    if (cadence === "weekdays" && (cursor.getDay() === 0 || cursor.getDay() === 6)) {
      cursor = nextDate(cursor);
    }
    let last = -1;
    for (let i = 0; i < count; i++) {
      let assignments: CalendarAssignment[];
      if (source === "scriptGroup" && chosenScriptGroup) {
        // Alternate ONE script from the group per day — rotate in order or
        // shuffle (no two same in a row). This is the "same script, different
        // CTA" rotation.
        const slugs = chosenScriptGroup.slugs;
        const idx =
          distribution === "rotate"
            ? i % slugs.length
            : randomIndex(slugs.length, last);
        last = idx;
        assignments = [{ id: genId(), formatSlug: slugs[idx] }];
      } else if (source === "group") {
        // Each day gets ONE whole group (all of its videos). Days rotate
        // through the chosen groups, or shuffle (avoiding back-to-back repeats).
        const idx =
          distribution === "rotate"
            ? i % chosenGroups.length
            : randomIndex(chosenGroups.length, last);
        last = idx;
        assignments = chosenGroups[idx].items.map(itemToAssignment);
      } else {
        assignments = picked.map((slug) => ({ id: genId(), formatSlug: slug }));
      }
      days.push({ date: toISODate(cursor), assignments });
      cursor = nextDate(cursor);
    }
    onGenerate(days);
  }

  const canGenerate =
    source === "scriptGroup"
      ? !!chosenScriptGroup && chosenScriptGroup.slugs.length > 0
      : source === "group"
        ? chosenGroups.length > 0
        : picked.length > 0;

  return (
    <div className="space-y-3">
      {/* Source toggle */}
      <div className="inline-flex border-2 border-line rounded-sm overflow-hidden flex-wrap">
        {[
          ...(usableScriptGroups.length > 0
            ? [{ key: "scriptGroup" as const, label: "Alternate script group" }]
            : []),
          { key: "group" as const, label: "Alternate groups" },
          { key: "formats" as const, label: "Pick formats" },
        ].map((o, i) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setSource(o.key)}
            className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
              i > 0 ? "border-l-2 border-line" : ""
            } ${
              source === o.key
                ? "bg-accent text-accent-ink"
                : "bg-background text-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
            Start
          </span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
            Cadence
          </span>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as Cadence)}
            className="mt-1 w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
          >
            {(Object.keys(CADENCE_LABELS) as Cadence[]).map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
            How many days
          </span>
          <input
            type="number"
            min={1}
            max={90}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
          />
        </label>
      </div>

      {source === "scriptGroup" ? (
        <div className="space-y-2">
          {/* Distribution */}
          <div className="inline-flex border-2 border-line rounded-sm overflow-hidden">
            {(["shuffle", "rotate"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDistribution(d)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                  d === "rotate" ? "border-l-2 border-line" : ""
                } ${
                  distribution === d
                    ? "bg-accent text-accent-ink"
                    : "bg-background text-muted"
                }`}
              >
                {d === "shuffle" ? "🎲 Shuffle" : "↻ Rotate"}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
              Script group to alternate
            </span>
            <select
              value={pickedScriptGroup}
              onChange={(e) => setPickedScriptGroup(e.target.value)}
              className="mt-1 w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
            >
              {usableScriptGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.slugs.length}
                </option>
              ))}
            </select>
          </label>
          {chosenScriptGroup && (
            <div className="flex gap-1.5 flex-wrap">
              {chosenScriptGroup.slugs.map((s) => (
                <span
                  key={s}
                  className="border-2 border-line rounded-md px-2 py-0.5 text-[10px] font-bold bg-background"
                >
                  {fmtTitle(s)}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted">
            One script per day from{" "}
            <span className="font-bold">{chosenScriptGroup?.name}</span>.{" "}
            {distribution === "shuffle"
              ? "Days pick a random one (no two same in a row)."
              : "Days rotate through them in order."}
          </p>
        </div>
      ) : source === "group" ? (
        usableGroups.length === 0 ? (
          <p className="text-xs text-muted">
            No groups with videos yet — add one in the{" "}
            <span className="font-bold">Groups</span> section above.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Distribution */}
            <div className="inline-flex border-2 border-line rounded-sm overflow-hidden">
              {(["shuffle", "rotate"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistribution(d)}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                    d === "rotate" ? "border-l-2 border-line" : ""
                  } ${
                    distribution === d
                      ? "bg-accent text-accent-ink"
                      : "bg-background text-muted"
                  }`}
                >
                  {d === "shuffle" ? "🎲 Shuffle" : "↻ Rotate"}
                </button>
              ))}
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
                Groups to alternate between
              </span>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {usableGroups.map((g) => {
                  const on = pickedGroups.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={`border-2 rounded-md px-2 py-1 text-xs font-bold nb-press ${
                        on
                          ? "border-line bg-accent text-accent-ink nb-shadow-sm"
                          : "border-line/40 bg-background text-muted"
                      }`}
                    >
                      {g.name} · {g.items.length}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-muted">
              Each day gets one whole group ({" "}
              <span className="font-bold">all its videos</span> ).{" "}
              {distribution === "shuffle"
                ? "Days pick a random group (no two same in a row)."
                : "Days rotate through them in order."}
            </p>
          </div>
        )
      ) : (
        <div>
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
            Formats to schedule each day
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 mt-1">
            {formats.map((f) => {
              const on = picked.includes(f.slug);
              return (
                <button
                  key={f.slug}
                  type="button"
                  onClick={() => toggleFmt(f.slug)}
                  className={`shrink-0 w-16 border-2 rounded-md overflow-hidden nb-press ${
                    on ? "border-line nb-shadow-sm" : "border-line/40 opacity-60"
                  }`}
                >
                  <FormatThumb fmt={f} size={60} />
                  <span className="block px-1 py-0.5 text-[8px] font-bold truncate">
                    {f.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={!canGenerate}
        className="w-full border-2 border-line bg-ink text-background rounded-md px-2 py-2 text-xs font-black uppercase tracking-widest nb-press disabled:opacity-40"
      >
        Generate {count} {count === 1 ? "day" : "days"}
      </button>
    </div>
  );
}

// Color-codes each group with one of a few accent hues so they read as
// distinct categories at a glance (less "stagnant").
const GROUP_HUES = ["#F1610B", "#2563EB", "#16A34A", "#9333EA", "#DB2777", "#0891B2"];

function GroupsManager({
  groups,
  formats,
  onChange,
}: {
  groups: CalendarGroup[];
  formats: FormatOption[];
  onChange: (groups: CalendarGroup[]) => void;
}) {
  const fmtBySlug = useMemo(() => {
    const m = new Map<string, FormatOption>();
    for (const f of formats) m.set(f.slug, f);
    return m;
  }, [formats]);

  // itemId currently open for note/custom editing; groupId whose add-strip is open.
  const [editing, setEditing] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  function patchGroup(id: string, patch: Partial<CalendarGroup>) {
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }
  function removeGroup(id: string) {
    onChange(groups.filter((g) => g.id !== id));
  }
  function addGroup() {
    const letter = String.fromCharCode(65 + groups.length); // A, B, C…
    onChange([...groups, { id: genId(), name: `Group ${letter}`, items: [] }]);
  }
  function setItems(gid: string, items: CalendarGroupItem[]) {
    patchGroup(gid, { items });
  }
  function addItem(g: CalendarGroup, formatSlug?: string) {
    const it: CalendarGroupItem = { id: genId(), formatSlug };
    setItems(g.id, [...g.items, it]);
    if (formatSlug === undefined) setEditing(it.id); // open editor for custom
  }
  function patchItem(g: CalendarGroup, id: string, patch: Partial<CalendarGroupItem>) {
    setItems(g.id, g.items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(g: CalendarGroup, id: string) {
    setItems(g.id, g.items.filter((it) => it.id !== id));
    if (editing === id) setEditing(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted leading-relaxed">
        A group is a <span className="font-bold">bundle of videos</span>. In{" "}
        <span className="font-bold">Auto-fill → Alternate groups</span>, each day
        gets one whole group; days rotate or shuffle between your groups.
      </p>

      {groups.map((g, gi) => {
        const hue = GROUP_HUES[gi % GROUP_HUES.length];
        const editItem = g.items.find((it) => it.id === editing);
        return (
          <div
            key={g.id}
            className="border-2 border-line rounded-md overflow-hidden"
            style={{ borderColor: hue }}
          >
            {/* Header band, color-coded per group */}
            <div
              className="flex items-center gap-2 px-2 py-1.5"
              style={{ backgroundColor: hue }}
            >
              <span className="w-5 h-5 rounded-full bg-white/90 text-ink flex items-center justify-center font-black text-[11px] shrink-0">
                {g.name.replace(/[^A-Za-z0-9]/g, "").slice(-1).toUpperCase() ||
                  String.fromCharCode(65 + gi)}
              </span>
              <input
                type="text"
                value={g.name}
                onChange={(e) => patchGroup(g.id, { name: e.target.value })}
                placeholder="Group name"
                className="flex-1 bg-transparent text-white placeholder-white/60 font-black text-sm focus:outline-none min-w-0"
              />
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/80">
                {g.items.length} {g.items.length === 1 ? "video" : "videos"}
              </span>
              <button
                type="button"
                onClick={() => removeGroup(g.id)}
                aria-label="Remove group"
                className="w-6 h-6 rounded-sm bg-white/90 text-ink font-black nb-press shrink-0"
              >
                ×
              </button>
            </div>

            <div className="p-2.5 space-y-2 bg-paper">
              {/* Video tiles */}
              {g.items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {g.items.map((it) => {
                    const isCustom = it.formatSlug === undefined;
                    const fmt = it.formatSlug ? fmtBySlug.get(it.formatSlug) : undefined;
                    const label = isCustom
                      ? it.title?.trim() || "Custom"
                      : fmt?.title ?? it.formatSlug;
                    const open = editing === it.id;
                    return (
                      <div key={it.id} className="relative w-[84px]">
                        <button
                          type="button"
                          onClick={() => setEditing(open ? null : it.id)}
                          className={`block w-full border-2 rounded-md overflow-hidden nb-press bg-background ${
                            open ? "border-accent nb-shadow-sm" : "border-line"
                          }`}
                        >
                          {isCustom ? (
                            <span className="w-full aspect-square bg-paper border-b-2 border-line flex items-center justify-center text-lg font-black text-muted">
                              ✎
                            </span>
                          ) : fmt?.thumbnail ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={thumbSrc(fmt.thumbnail)}
                              alt=""
                              className="w-full aspect-square object-cover border-b-2 border-line"
                            />
                          ) : (
                            <span className="w-full aspect-square bg-accent text-accent-ink border-b-2 border-line flex items-center justify-center font-black">
                              {(label ?? "?").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="block px-1 py-1 text-[9px] font-bold truncate leading-tight">
                            {label}
                          </span>
                        </button>
                        {it.note?.trim() && (
                          <span
                            title="Has a note"
                            className="absolute bottom-6 left-1 w-2 h-2 rounded-full bg-accent border border-line"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(g, it.id)}
                          aria-label="Remove video"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-background border-2 border-line rounded-full text-[11px] font-black leading-none flex items-center justify-center nb-press"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inline editor for the selected tile */}
              {editItem && (
                <div className="border-2 border-line bg-background rounded-md p-2 space-y-1.5">
                  {editItem.formatSlug === undefined && (
                    <>
                      <input
                        type="text"
                        value={editItem.title ?? ""}
                        onChange={(e) => patchItem(g, editItem.id, { title: e.target.value })}
                        placeholder="Custom script title"
                        className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
                      />
                      <textarea
                        value={editItem.script ?? ""}
                        onChange={(e) => patchItem(g, editItem.id, { script: e.target.value })}
                        rows={2}
                        placeholder={"0–2s: Hook…"}
                        className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background font-mono leading-relaxed"
                      />
                    </>
                  )}
                  <input
                    type="text"
                    value={editItem.note ?? ""}
                    onChange={(e) => patchItem(g, editItem.id, { note: e.target.value })}
                    placeholder="Note for this video (optional)"
                    className="w-full border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
                  />
                </div>
              )}

              {/* Add videos */}
              {addingTo === g.id ? (
                <div className="border-2 border-dashed border-line rounded-md p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
                      Tap to add
                    </span>
                    <button
                      type="button"
                      onClick={() => setAddingTo(null)}
                      className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-ink"
                    >
                      Done
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {formats.map((f) => (
                      <button
                        key={f.slug}
                        type="button"
                        onClick={() => addItem(g, f.slug)}
                        title={`Add ${f.title}`}
                        className="shrink-0 w-16 border-2 border-line bg-background rounded-md overflow-hidden nb-press"
                      >
                        <FormatThumb fmt={f} size={60} />
                        <span className="block px-1 py-0.5 text-[8px] font-bold truncate">
                          {f.title}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => addItem(g)}
                      title="Add custom video"
                      className="shrink-0 w-16 border-2 border-dashed border-line bg-background rounded-md nb-press flex flex-col items-center justify-center gap-0.5 py-2 text-muted hover:text-accent hover:border-accent"
                    >
                      <span className="text-lg font-black leading-none">+</span>
                      <span className="text-[8px] font-bold uppercase tracking-widest">
                        Custom
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTo(g.id)}
                  className="w-full border-2 border-dashed border-line bg-background rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
                >
                  + Add videos
                </button>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addGroup}
        className="w-full border-2 border-line bg-ink text-background rounded-md px-2 py-2 text-xs font-black uppercase tracking-widest nb-press"
      >
        + Add group
      </button>
    </div>
  );
}
