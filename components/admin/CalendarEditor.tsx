"use client";

import { useMemo } from "react";
import type {
  CalendarAssignment,
  CalendarDay,
  ContentCalendar,
} from "@/lib/db";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

function prettyDate(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso || "No date";
  return `${WEEKDAYS[d.getDay()]} ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const EMPTY: ContentCalendar = { enabled: false, days: [] };

export function CalendarEditor({
  value,
  formats,
  onChange,
}: {
  value: ContentCalendar | undefined;
  formats: { slug: string; title: string }[];
  onChange: (next: ContentCalendar | undefined) => void;
}) {
  const cal = value ?? EMPTY;

  // Days sorted by date for display; empty-date days sort last.
  const sortedDays = useMemo(() => {
    return [...cal.days]
      .map((d, i) => ({ d, i }))
      .sort((a, b) => {
        if (!a.d.date) return 1;
        if (!b.d.date) return -1;
        return a.d.date.localeCompare(b.d.date);
      });
  }, [cal.days]);

  function update(patch: Partial<ContentCalendar>) {
    onChange({ ...cal, ...patch });
  }

  function setDays(days: CalendarDay[]) {
    update({ days });
  }

  function addDay() {
    // Default to the day after the latest scheduled date, else today.
    const dated = cal.days.map((d) => d.date).filter(Boolean).sort();
    const base = dated.length ? parseISODate(dated[dated.length - 1]) : null;
    const next = base ? new Date(base.getTime()) : new Date();
    if (base) next.setDate(next.getDate() + 1);
    setDays([...cal.days, { date: toISODate(next), assignments: [] }]);
  }

  function patchDay(realIdx: number, patch: Partial<CalendarDay>) {
    const days = cal.days.map((d, i) => (i === realIdx ? { ...d, ...patch } : d));
    setDays(days);
  }

  function removeDay(realIdx: number) {
    setDays(cal.days.filter((_, i) => i !== realIdx));
  }

  function addAssignment(realIdx: number) {
    const day = cal.days[realIdx];
    const next: CalendarAssignment = {
      id: genId(),
      formatSlug: formats[0]?.slug,
    };
    patchDay(realIdx, { assignments: [...day.assignments, next] });
  }

  function patchAssignment(
    realIdx: number,
    aIdx: number,
    patch: Partial<CalendarAssignment>
  ) {
    const day = cal.days[realIdx];
    const assignments = day.assignments.map((a, i) =>
      i === aIdx ? { ...a, ...patch } : a
    );
    patchDay(realIdx, { assignments });
  }

  function removeAssignment(realIdx: number, aIdx: number) {
    const day = cal.days[realIdx];
    patchDay(realIdx, {
      assignments: day.assignments.filter((_, i) => i !== aIdx),
    });
  }

  const totalScripts = cal.days.reduce((n, d) => n + d.assignments.length, 0);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
        <input
          type="checkbox"
          checked={!!cal.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        <span>
          Show the Content Calendar on the public brief (adds a sidebar link
          for creators)
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Title
          </span>
          <input
            type="text"
            value={cal.title ?? ""}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="What to film, and when"
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 font-bold focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Intro (optional)
          </span>
          <textarea
            value={cal.intro ?? ""}
            onChange={(e) => update({ intro: e.target.value })}
            rows={2}
            placeholder="e.g. Batch-record a week at a time. Each day below has the scripts to shoot."
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          {cal.days.length} {cal.days.length === 1 ? "day" : "days"} ·{" "}
          {totalScripts} {totalScripts === 1 ? "script" : "scripts"}
        </div>
      </div>

      <div className="space-y-3">
        {sortedDays.map(({ d, i: realIdx }) => (
          <div
            key={realIdx}
            className="border-2 border-line bg-paper rounded-md p-3 space-y-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={d.date}
                onChange={(e) => patchDay(realIdx, { date: e.target.value })}
                className="border-2 border-line rounded-md px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
              />
              <span className="text-xs font-bold text-muted">
                {prettyDate(d.date)}
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
                · {d.assignments.length}{" "}
                {d.assignments.length === 1 ? "script" : "scripts"}
              </span>
              <button
                type="button"
                onClick={() => removeDay(realIdx)}
                aria-label="Remove day"
                className="ml-auto w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {d.assignments.map((a, aIdx) => {
                const isCustom = a.formatSlug === undefined;
                return (
                  <div
                    key={a.id}
                    className="border-2 border-line bg-background rounded-md p-2.5 space-y-2"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="inline-flex border-2 border-line rounded-sm overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            patchAssignment(realIdx, aIdx, {
                              formatSlug: formats[0]?.slug ?? "",
                            })
                          }
                          className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                            !isCustom
                              ? "bg-accent text-accent-ink"
                              : "bg-background text-muted"
                          }`}
                        >
                          Link format
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchAssignment(realIdx, aIdx, {
                              formatSlug: undefined,
                            })
                          }
                          className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest border-l-2 border-line ${
                            isCustom
                              ? "bg-accent text-accent-ink"
                              : "bg-background text-muted"
                          }`}
                        >
                          Custom script
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAssignment(realIdx, aIdx)}
                        aria-label="Remove script"
                        className="ml-auto w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press"
                      >
                        ×
                      </button>
                    </div>

                    {!isCustom ? (
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                          Format
                        </span>
                        {formats.length === 0 ? (
                          <p className="text-xs text-muted mt-1">
                            No visible formats to link. Add a format or use a
                            custom script.
                          </p>
                        ) : (
                          <select
                            value={a.formatSlug ?? ""}
                            onChange={(e) =>
                              patchAssignment(realIdx, aIdx, {
                                formatSlug: e.target.value,
                              })
                            }
                            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-accent bg-background"
                          >
                            {formats.map((f) => (
                              <option key={f.slug} value={f.slug}>
                                {f.title}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                    ) : (
                      <>
                        <label className="block">
                          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                            Title
                          </span>
                          <input
                            type="text"
                            value={a.title ?? ""}
                            onChange={(e) =>
                              patchAssignment(realIdx, aIdx, {
                                title: e.target.value,
                              })
                            }
                            placeholder="e.g. Morning routine hook"
                            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-accent bg-background"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                            Script
                          </span>
                          <textarea
                            value={a.script ?? ""}
                            onChange={(e) =>
                              patchAssignment(realIdx, aIdx, {
                                script: e.target.value,
                              })
                            }
                            rows={4}
                            placeholder={"0–2s: Hook…\n2–10s: Setup…\n…"}
                            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed font-mono"
                          />
                        </label>
                      </>
                    )}

                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                        Note for this day (optional)
                      </span>
                      <textarea
                        value={a.note ?? ""}
                        onChange={(e) =>
                          patchAssignment(realIdx, aIdx, {
                            note: e.target.value,
                          })
                        }
                        rows={2}
                        placeholder="e.g. Use the 'someone showed me' hook. Push the 'Rork' keyword."
                        className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
                      />
                    </label>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => addAssignment(realIdx)}
                className="w-full border-2 border-dashed border-line bg-background rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
              >
                + Add script to this day
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addDay}
        className="w-full border-2 border-line bg-ink text-background rounded-md px-2 py-2 text-xs font-black uppercase tracking-widest nb-press"
      >
        + Add day
      </button>

      <p className="text-[10px] text-muted">
        Days appear on the public calendar sorted by date. Changes save when you
        hit <span className="font-bold">Save</span> at the top.
      </p>
    </div>
  );
}
