"use client";

import { useMemo, useState } from "react";
import type {
  CalendarAssignment,
  CalendarDay,
  CalendarGroup,
  CalendarGroupItem,
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
  const [showGroups, setShowGroups] = useState(false);

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
                        <span className="font-bold text-sm leading-tight truncate">
                          {fmt?.title ?? a.formatSlug}
                        </span>
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

// Random group index for shuffle, avoiding an immediate repeat. Module-level
// so the impure Math.random call isn't inside a component body.
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
  defaultStart,
  onGenerate,
}: {
  formats: FormatOption[];
  groups: CalendarGroup[];
  defaultStart: string;
  onGenerate: (days: CalendarDay[]) => void;
}) {
  const usableGroups = groups.filter((g) => g.items.length > 0);
  const [source, setSource] = useState<"group" | "formats">(
    usableGroups.length > 0 ? "group" : "formats"
  );
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
    const days: CalendarDay[] = [];
    let cursor = startDate;
    if (cadence === "weekdays" && (cursor.getDay() === 0 || cursor.getDay() === 6)) {
      cursor = nextDate(cursor);
    }
    let last = -1;
    for (let i = 0; i < count; i++) {
      let assignments: CalendarAssignment[];
      if (source === "group") {
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
    source === "group" ? chosenGroups.length > 0 : picked.length > 0;

  return (
    <div className="space-y-3">
      {/* Source toggle */}
      <div className="inline-flex border-2 border-line rounded-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setSource("group")}
          className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
            source === "group" ? "bg-accent text-accent-ink" : "bg-background text-muted"
          }`}
        >
          Alternate groups
        </button>
        <button
          type="button"
          onClick={() => setSource("formats")}
          className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-l-2 border-line ${
            source === "formats" ? "bg-accent text-accent-ink" : "bg-background text-muted"
          }`}
        >
          Pick formats
        </button>
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

      {source === "group" ? (
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
                              src={fmt.thumbnail}
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
