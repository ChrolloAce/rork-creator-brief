"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ContentCalendar as ContentCalendarData } from "@/lib/db";
import type { Format } from "@/lib/types";

// Monday-first weekday labels. JS getDay() is Sunday=0, so we remap.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Parse "YYYY-MM-DD" into a local Date (no timezone surprises from the
// Date(string) constructor, which treats bare dates as UTC).
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

// Index 0..6 with Monday = 0.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function prettyDate(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return `${WEEKDAYS[mondayIndex(d)]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function ContentCalendarView({
  calendar,
  formats,
  briefSlug,
}: {
  calendar: ContentCalendarData;
  formats: Format[];
  briefSlug: string;
}) {
  const router = useRouter();
  const formatBySlug = useMemo(() => {
    const map = new Map<string, Format>();
    for (const f of formats) map.set(f.slug, f);
    return map;
  }, [formats]);

  // "Done" state lives only in this device's localStorage — no account, no
  // server, no personal data. Each creator's progress stays on their device.
  const storageKey = `superbriefed:cal-done:${briefSlug}`;
  const [done, setDone] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // date(ISO) -> assignment count, plus quick lookup of a day's assignments.
  const dayByDate = useMemo(() => {
    const map = new Map<string, ContentCalendarData["days"][number]>();
    for (const d of calendar.days) {
      if (d.date) map.set(d.date, d);
    }
    return map;
  }, [calendar.days]);

  const scheduledDates = useMemo(
    () =>
      [...dayByDate.keys()]
        .filter((iso) => (dayByDate.get(iso)?.assignments.length ?? 0) > 0)
        .sort(),
    [dayByDate]
  );

  // Default the visible month + selected day to the first scheduled date,
  // else today.
  const firstScheduled = scheduledDates[0];
  const initial = firstScheduled
    ? parseISODate(firstScheduled) ?? new Date()
    : new Date();

  const [view, setView] = useState({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(
    firstScheduled ?? null
  );

  // Build the grid: leading blanks for the first week, then each day.
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const lead = mondayIndex(first);
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(toISODate(new Date(view.year, view.month, d)));
    }
    return out;
  }, [view]);

  const todayISO = toISODate(new Date());

  function step(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  const selectedDay = selected ? dayByDate.get(selected) : undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 border-2 border-line bg-accent text-accent-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm">
          Content Calendar
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
          {calendar.title?.trim() || "What to film, and when"}
        </h1>
        {calendar.intro?.trim() && (
          <p className="text-base sm:text-lg text-ink-soft max-w-2xl leading-relaxed whitespace-pre-line">
            {calendar.intro}
          </p>
        )}
        <p className="text-sm text-muted">
          Tap any highlighted day to see the scripts to record. Look ahead and
          batch-record several at once.
        </p>
      </header>

      {/* Month grid */}
      <section className="border-2 border-line bg-background rounded-md nb-shadow p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-black">
            {MONTHS[view.month]} {view.year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous month"
              className="w-9 h-9 border-2 border-line bg-background rounded-md font-black nb-press flex items-center justify-center"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setView({
                  year: new Date().getFullYear(),
                  month: new Date().getMonth(),
                })
              }
              className="border-2 border-line bg-background px-2.5 h-9 rounded-md font-black nb-press text-[10px] uppercase tracking-widest"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next month"
              className="w-9 h-9 border-2 border-line bg-background rounded-md font-black nb-press flex items-center justify-center"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[10px] uppercase tracking-[0.15em] font-bold text-muted py-1"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`blank-${i}`} aria-hidden />;
            const day = dayByDate.get(iso);
            const count = day?.assignments.length ?? 0;
            const has = count > 0;
            const isSelected = selected === iso;
            const isToday = iso === todayISO;
            const dayNum = Number(iso.slice(8, 10));
            const allDone =
              has && day!.assignments.every((a) => done.has(a.id));
            // Orange = videos pending, Green = all done, neutral = nothing.
            const statusClass = !has
              ? "border-line/40 bg-background text-muted cursor-default"
              : allDone
                ? "border-line bg-success text-success-ink"
                : "border-line bg-accent text-accent-ink";
            return (
              <button
                key={iso}
                type="button"
                disabled={!has}
                onClick={() => setSelected(iso)}
                aria-pressed={isSelected}
                aria-label={`${prettyDate(iso)}${
                  has
                    ? allDone
                      ? ", all done"
                      : `, ${count} ${count === 1 ? "video" : "videos"} to film`
                    : ""
                }`}
                className={`min-h-[72px] sm:min-h-[88px] border-2 rounded-md p-2 text-left flex flex-col transition-transform ${statusClass} ${
                  isSelected ? "nb-shadow-sm -translate-y-0.5" : ""
                } ${isToday && !isSelected ? "ring-2 ring-line ring-offset-1" : ""}`}
              >
                <span className="text-sm font-black leading-none">{dayNum}</span>
                {has && (
                  <span className="mt-auto text-[10px] font-black uppercase tracking-widest leading-none">
                    {allDone ? "✓ done" : "to film"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected day detail */}
      {selectedDay && selectedDay.assignments.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h2 className="text-xl font-black">{prettyDate(selectedDay.date)}</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(() => {
                const total = selectedDay.assignments.length;
                const doneCount = selectedDay.assignments.filter((a) =>
                  done.has(a.id)
                ).length;
                return doneCount > 0 ? (
                  <span className="inline-flex items-center border-2 border-line bg-success text-success-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest rounded-sm">
                    {doneCount}/{total} done
                  </span>
                ) : null;
              })()}
              <span className="inline-flex items-center border-2 border-line bg-accent text-accent-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest rounded-sm">
                {selectedDay.assignments.length}{" "}
                {selectedDay.assignments.length === 1 ? "script" : "scripts"} to film
              </span>
            </div>
          </div>
          <ol className="space-y-3">
            {selectedDay.assignments.map((a, i) => {
              const linked = a.formatSlug
                ? formatBySlug.get(a.formatSlug)
                : undefined;
              const heading =
                a.title?.trim() || linked?.title || "Script";
              const thumb =
                linked?.thumbnail || linked?.examples?.[0]?.thumbnail;
              const isDone = done.has(a.id);
              const href = linked
                ? `/b/${briefSlug}/formats/${linked.slug}`
                : undefined;
              return (
                <li
                  key={a.id}
                  onClick={href ? () => router.push(href) : undefined}
                  onKeyDown={
                    href
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(href);
                          }
                        }
                      : undefined
                  }
                  role={href ? "link" : undefined}
                  tabIndex={href ? 0 : undefined}
                  className={`border-2 border-line rounded-md nb-shadow-sm p-4 sm:p-5 ${
                    href ? "cursor-pointer hover:border-accent" : ""
                  } ${isDone ? "bg-paper opacity-70" : "bg-background"}`}
                >
                  <div className="flex items-start gap-3">
                    {thumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={thumb}
                        alt=""
                        className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 object-cover border-2 border-line rounded-md bg-paper"
                      />
                    ) : (
                      <span className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 border-2 border-line bg-paper flex items-center justify-center font-mono text-sm font-bold rounded-md">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 space-y-3">
                      <h3 className="text-lg font-black leading-tight flex items-center gap-2 flex-wrap">
                        {a.label?.trim() && (
                          <span className="shrink-0 border-2 border-line bg-accent text-accent-ink px-2 py-0.5 rounded-sm text-xs font-black uppercase tracking-widest">
                            {a.label}
                          </span>
                        )}
                        {heading}
                      </h3>
                      {a.note?.trim() && (
                        <div className="border-l-2 border-accent pl-3">
                          <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                            <span className="font-bold">Note: </span>
                            {a.note}
                          </p>
                        </div>
                      )}
                      {a.script?.trim() && (
                        <div className="border-2 border-line bg-paper rounded-md p-3 sm:p-4">
                          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                            Script
                          </div>
                          <p className="text-ink leading-relaxed whitespace-pre-line text-sm">
                            {a.script}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {linked && href && (
                          <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex border-2 border-line bg-accent text-accent-ink px-2.5 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
                          >
                            Open format →
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDone(a.id);
                          }}
                          aria-pressed={isDone}
                          className={`inline-flex items-center gap-1.5 border-2 border-line px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest ${
                            isDone
                              ? "bg-success text-success-ink"
                              : "bg-background text-ink"
                          }`}
                        >
                          {isDone ? "✓ Done" : "Mark as done"}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <section className="border-2 border-dashed border-line rounded-md p-6 text-center">
          <p className="text-sm font-bold text-muted">
            {scheduledDates.length === 0
              ? "No days scheduled yet."
              : "Pick a highlighted day above to see the scripts."}
          </p>
        </section>
      )}
    </div>
  );
}
