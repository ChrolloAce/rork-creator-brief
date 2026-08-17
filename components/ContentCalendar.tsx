"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ContentCalendar as ContentCalendarData } from "@/lib/db";
import type { Format } from "@/lib/types";
import { CAL_MONTHS, CAL_WEEKDAYS, t, type Lang } from "@/lib/i18n";

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

function prettyDate(iso: string, lang: Lang): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return `${CAL_WEEKDAYS[lang][mondayIndex(d)]} · ${CAL_MONTHS[lang][d.getMonth()]} ${d.getDate()}`;
}

export function ContentCalendarView({
  calendar,
  formats,
  briefSlug,
  lang = "en",
}: {
  calendar: ContentCalendarData;
  formats: Format[];
  briefSlug: string;
  lang?: Lang;
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

  // Default to today; the last-viewed day is restored on mount so leaving and
  // returning resumes where you were. The Today button jumps back to now.
  const now = new Date();
  const todayISO = toISODate(now);

  const [view, setView] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(todayISO);

  const selKey = `superbriefed:cal-sel:${briefSlug}`;
  function selectDay(iso: string) {
    setSelected(iso);
    try {
      localStorage.setItem(selKey, iso);
    } catch {
      /* ignore */
    }
  }
  function goToToday() {
    setView({ year: now.getFullYear(), month: now.getMonth() });
    selectDay(todayISO);
  }
  // Restore the last-viewed day (per device) on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(selKey);
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        setSelected(saved);
        const d = parseISODate(saved);
        if (d) setView({ year: d.getFullYear(), month: d.getMonth() });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

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
          {t(lang, "contentCalendar")}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
          {calendar.title?.trim() || t(lang, "whatToFilm")}
        </h1>
        {calendar.intro?.trim() && (
          <p className="text-base sm:text-lg text-ink-soft max-w-2xl leading-relaxed whitespace-pre-line">
            {calendar.intro}
          </p>
        )}
        <p className="text-sm text-muted">{t(lang, "tapDay")}</p>
      </header>

      {/* Month grid */}
      <section className="border-2 border-line bg-background rounded-md nb-shadow p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-black">
            {CAL_MONTHS[lang][view.month]} {view.year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t(lang, "prevMonth")}
              className="w-9 h-9 border-2 border-line bg-background rounded-md font-black nb-press flex items-center justify-center"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="border-2 border-line bg-background px-2.5 h-9 rounded-md font-black nb-press text-[10px] uppercase tracking-widest"
            >
              {t(lang, "today")}
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t(lang, "nextMonth")}
              className="w-9 h-9 border-2 border-line bg-background rounded-md font-black nb-press flex items-center justify-center"
            >
              ›
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3 text-[10px] font-bold uppercase tracking-widest text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border-2 border-line bg-accent" />
            {t(lang, "toFilm")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border-2 border-line bg-success" />
            {t(lang, "doneWord")}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {CAL_WEEKDAYS[lang].map((w) => (
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
                onClick={() => selectDay(iso)}
                aria-pressed={isSelected}
                aria-label={`${prettyDate(iso, lang)}${
                  has
                    ? allDone
                      ? `, ${t(lang, "allDone")}`
                      : `, ${count} ${count === 1 ? t(lang, "videoWord") : t(lang, "videosWord")} ${t(lang, "toFilmSuffix")}`
                    : ""
                }`}
                className={`min-h-[44px] sm:min-h-[56px] border-2 rounded-md p-2 text-left transition-transform ${statusClass} ${
                  isSelected ? "nb-shadow-sm -translate-y-0.5" : ""
                } ${isToday && !isSelected ? "ring-2 ring-line ring-offset-1" : ""}`}
              >
                <span className="text-sm font-black leading-none">{dayNum}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected day detail */}
      {selectedDay && selectedDay.assignments.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h2 className="text-xl font-black">
              {prettyDate(selectedDay.date, lang)}
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(() => {
                const total = selectedDay.assignments.length;
                const doneCount = selectedDay.assignments.filter((a) =>
                  done.has(a.id)
                ).length;
                return doneCount > 0 ? (
                  <span className="inline-flex items-center border-2 border-line bg-success text-success-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest rounded-sm">
                    {doneCount}/{total} {t(lang, "doneSuffix")}
                  </span>
                ) : null;
              })()}
              <span className="inline-flex items-center border-2 border-line bg-accent text-accent-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest rounded-sm">
                {selectedDay.assignments.length}{" "}
                {selectedDay.assignments.length === 1
                  ? t(lang, "scriptWord")
                  : t(lang, "scriptsWord")}{" "}
                {t(lang, "toFilmSuffix")}
              </span>
            </div>
          </div>
          <ol className="space-y-3">
            {selectedDay.assignments.map((a, i) => {
              const linked = a.formatSlug
                ? formatBySlug.get(a.formatSlug)
                : undefined;
              const heading =
                a.title?.trim() || linked?.title || t(lang, "script");
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
                            <span className="font-bold">{t(lang, "noteLabel")}</span>
                            {a.note}
                          </p>
                        </div>
                      )}
                      {a.script?.trim() && (
                        <div className="border-2 border-line bg-paper rounded-md p-3 sm:p-4">
                          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                            {t(lang, "script")}
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
                            {t(lang, "openFormat")}
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
                          {isDone ? t(lang, "doneCheck") : t(lang, "markDone")}
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
            {scheduledDates.length === 0 ? t(lang, "noDays") : t(lang, "pickDay")}
          </p>
        </section>
      )}
    </div>
  );
}
