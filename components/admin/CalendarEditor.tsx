"use client";

import { useMemo, useState } from "react";
import type {
  CalendarAssignment,
  CalendarDay,
  ContentCalendar,
} from "@/lib/db";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type FormatOption = { slug: string; title: string; thumbnail?: string };

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

// Small thumbnail/initial used in the picker and day cells.
function FormatThumb({
  fmt,
  size = 40,
}: {
  fmt: FormatOption | undefined;
  size?: number;
}) {
  const dim = { width: size, height: size };
  if (fmt?.thumbnail) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={fmt.thumbnail}
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
      className="shrink-0 border-2 border-line rounded-sm bg-accent text-accent-ink flex items-center justify-center font-black text-[11px]"
    >
      {initials}
    </span>
  );
}

export function CalendarEditor({
  value,
  formats,
  onChange,
}: {
  value: ContentCalendar | undefined;
  formats: FormatOption[];
  onChange: (next: ContentCalendar | undefined) => void;
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

      {/* Month grid */}
      <div className="border-2 border-line bg-background rounded-md p-3">
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
      </div>

      {/* Selected day editor */}
      <div className="border-2 border-line bg-paper rounded-md p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-black">{prettyDate(selected)}</div>
          <input
            type="date"
            value={selected}
            onChange={(e) => e.target.value && setSelected(e.target.value)}
            className="border-2 border-line rounded-sm px-2 py-1 text-xs font-bold focus:outline-none focus:border-accent bg-background"
          />
        </div>

        {/* Thumbnail picker — tap a format to add it to this day */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
            Tap to add a script
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {formats.map((f) => (
              <button
                key={f.slug}
                type="button"
                onClick={() => addToSelected({ id: genId(), formatSlug: f.slug })}
                title={`Add ${f.title}`}
                className="shrink-0 w-20 border-2 border-line bg-background rounded-md overflow-hidden nb-press"
              >
                <span className="block">
                  <FormatThumb fmt={f} size={76} />
                </span>
                <span className="block px-1 py-1 text-[9px] font-bold leading-tight truncate">
                  {f.title}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => addToSelected({ id: genId() })}
              title="Add a custom script"
              className="shrink-0 w-20 border-2 border-dashed border-line bg-background rounded-md nb-press flex flex-col items-center justify-center gap-1 py-2 text-muted hover:text-accent hover:border-accent"
            >
              <span className="text-xl font-black leading-none">+</span>
              <span className="text-[9px] font-bold uppercase tracking-widest">
                Custom
              </span>
            </button>
          </div>
        </div>

        {/* This day's assignments */}
        {selAssignments.length === 0 ? (
          <p className="text-xs text-muted">
            Nothing scheduled — tap a format above to add a script.
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
                  {!isCustom && <FormatThumb fmt={fmt} size={44} />}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {isCustom ? (
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
                    ) : (
                      <div className="font-bold text-sm leading-tight pt-0.5">
                        {fmt?.title ?? a.formatSlug}
                      </div>
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

function AutoFill({
  formats,
  defaultStart,
  onGenerate,
}: {
  formats: FormatOption[];
  defaultStart: string;
  onGenerate: (days: CalendarDay[]) => void;
}) {
  const [start, setStart] = useState(defaultStart);
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [count, setCount] = useState(7);
  const [picked, setPicked] = useState<string[]>(
    formats[0] ? [formats[0].slug] : []
  );

  function toggle(slug: string) {
    setPicked((p) =>
      p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]
    );
  }

  function nextDate(d: Date): Date {
    const n = new Date(d.getTime());
    if (cadence === "daily") n.setDate(n.getDate() + 1);
    else if (cadence === "alt") n.setDate(n.getDate() + 2);
    else if (cadence === "weekly") n.setDate(n.getDate() + 7);
    else {
      // weekdays: advance to next Mon–Fri
      do {
        n.setDate(n.getDate() + 1);
      } while (n.getDay() === 0 || n.getDay() === 6);
    }
    return n;
  }

  function generate() {
    const startDate = parseISODate(start);
    if (!startDate || picked.length === 0 || count < 1) return;
    const days: CalendarDay[] = [];
    let cursor = startDate;
    // For weekdays cadence, snap the first date forward off a weekend.
    if (cadence === "weekdays" && (cursor.getDay() === 0 || cursor.getDay() === 6)) {
      cursor = nextDate(cursor);
    }
    for (let i = 0; i < count; i++) {
      days.push({
        date: toISODate(cursor),
        assignments: picked.map((slug) => ({ id: genId(), formatSlug: slug })),
      });
      cursor = nextDate(cursor);
    }
    onGenerate(days);
  }

  return (
    <div className="space-y-3">
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
            How many
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
                onClick={() => toggle(f.slug)}
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

      <button
        type="button"
        onClick={generate}
        disabled={picked.length === 0}
        className="w-full border-2 border-line bg-ink text-background rounded-md px-2 py-2 text-xs font-black uppercase tracking-widest nb-press disabled:opacity-40"
      >
        Generate {count} {count === 1 ? "day" : "days"}
      </button>
    </div>
  );
}
