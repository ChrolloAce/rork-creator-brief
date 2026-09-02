// Per-creator rotation.
//
// A calendar day used to hold one assignment that every creator saw. A slot can
// now carry a pool of interchangeable options, and each creator is handed one
// of them deterministically. Same creator + same day always resolves to the
// same option (so nobody's schedule changes under them on refresh), but two
// creators on the same day usually land on different ones.
//
// Deterministic, not random: no state to store, nothing to keep in sync, and
// the public page can resolve it during SSR.

import type { AutoRotation, CalendarAssignment, CalendarDay, ContentCalendar } from "./db";

// FNV-1a. Small, stable across runtimes, and good enough for spreading a
// handful of creators over a handful of options.
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// The stable per-creator identity used as the rotation seed. Falls back to a
// constant so anonymous viewers still get a valid (shared) schedule rather
// than an error.
export function creatorSeed(creatorKey: string | null | undefined): string {
  const k = (creatorKey ?? "").trim();
  return k || "anonymous";
}

// A creator as far as rotation is concerned. `userId` is the seed; it is null
// on code-only briefs, where there is no per-person identity to rotate on.
export type RotationCreator = {
  id: string;
  name: string;
  userId: string | null;
  status: string;
};

export type RotationOption = {
  formatSlug?: string;
  title?: string;
  script?: string;
  note?: string;
  label?: string;
};

// Everything a slot could hand out: the assignment itself first, then its pool.
// The assignment stays index 0 so a slot with an empty pool behaves exactly as
// it did before rotation existed.
export function optionsOf(a: CalendarAssignment): RotationOption[] {
  const base: RotationOption = {
    formatSlug: a.formatSlug,
    title: a.title,
    script: a.script,
    note: a.note,
    label: a.label,
  };
  const pool = a.pool ?? [];
  return pool.length > 0 ? [base, ...pool] : [base];
}

// Which option this creator gets for this slot. Mixing the date and the slot id
// into the seed means a creator who gets option B today is not pinned to option
// B forever; the assignment reshuffles per day.
export function pickForCreator(
  a: CalendarAssignment,
  creatorKey: string | null | undefined,
  date: string
): RotationOption {
  const options = optionsOf(a);
  if (options.length === 1) return options[0];
  const seed = hashString(`${creatorSeed(creatorKey)}::${date}::${a.id}`);
  return options[seed % options.length];
}

// Resolve a whole day for one creator. Shape is unchanged, so the public
// calendar renders exactly as before; only which option each slot carries
// differs per person.
export function resolveAssignment(
  a: CalendarAssignment,
  creatorKey: string | null | undefined,
  date: string
): CalendarAssignment {
  const pick = pickForCreator(a, creatorKey, date);
  return {
    id: a.id,
    formatSlug: pick.formatSlug,
    title: pick.title,
    script: pick.script,
    note: pick.note,
    label: pick.label,
  };
}

/* ------------------------------ auto-rotation ---------------------------- */

// A deterministic permutation of 0..n-1 from one seed. Fisher-Yates driven by
// a small LCG so the same seed always yields the same order on any runtime.
export function seededOrder(n: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let state = (seed || 1) >>> 0;
  const next = () => {
    // Numerical Recipes LCG; fine for dealing a deck of a few dozen scripts.
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  return day === 0 || day === 6;
}

// The dates a rotation covers, honouring the cadence.
export function rotationDates(cfg: AutoRotation): string[] {
  const out: string[] = [];
  const want = Math.max(0, Math.min(cfg.days ?? 0, 400));
  for (let step = 0; out.length < want && step < want * 3 + 14; step++) {
    const iso = addDays(cfg.start, step);
    if (cfg.cadence === "weekdays" && isWeekend(iso)) continue;
    out.push(iso);
  }
  return out;
}

// Deal one creator their own schedule. Each creator gets a different shuffle of
// the same pool, walked in order, so nobody repeats a script until the pool is
// used up and two creators rarely film the same thing on the same day.
export function autoDaysForCreator(
  cfg: AutoRotation,
  creatorKey: string | null | undefined
): CalendarDay[] {
  const pool = cfg.slugs.filter(Boolean);
  if (!cfg.enabled || pool.length === 0) return [];
  const perDay = Math.max(1, Math.min(cfg.perDay || 1, 10));
  const order = seededOrder(
    pool.length,
    hashString(`${creatorSeed(creatorKey)}::${pool.length}::${cfg.start}`)
  );
  return rotationDates(cfg).map((date, dayIndex) => ({
    date,
    assignments: Array.from({ length: perDay }, (_, k) => {
      const slot = dayIndex * perDay + k;
      const slug = pool[order[slot % pool.length]];
      return {
        // Stable id: the same creator on the same day keeps the same slot id
        // across refreshes, which matters for React keys and deep links.
        id: `auto-${date}-${k}`,
        formatSlug: slug,
        label: `D${dayIndex + 1}`,
      } as CalendarAssignment;
    }),
  }));
}

// Resolve every day of a calendar for one creator. The returned shape is
// identical to the input, so the public calendar component needs no changes.
// Hand-built days win over generated ones for the same date, so a one-off
// override is always possible without turning the rotation off.
export function resolveCalendarForCreator(
  cal: ContentCalendar,
  creatorKey: string | null | undefined
): ContentCalendar {
  const manual = cal.days.map((d) => ({
    ...d,
    assignments: d.assignments.map((a) => resolveAssignment(a, creatorKey, d.date)),
  }));
  const auto = cal.autoRotation
    ? autoDaysForCreator(cal.autoRotation, creatorKey)
    : [];
  if (auto.length === 0) return { ...cal, days: manual };
  const byDate = new Map(auto.map((d) => [d.date, d]));
  for (const d of manual) byDate.set(d.date, d);
  return {
    ...cal,
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// A numeric seed for choosing among a format's live script variants, so two
// creators opening the same format page get different live variants.
export function variantSeed(
  creatorKey: string | null | undefined,
  formatSlug: string
): number {
  return hashString(`${creatorSeed(creatorKey)}::${formatSlug}`);
}

// How evenly a pool would spread across a set of creators. Used by the admin
// preview so the split is visible before it ships, rather than a promise.
export function distribution(
  a: CalendarAssignment,
  creatorKeys: string[],
  date: string
): number[] {
  const options = optionsOf(a);
  const counts = new Array(options.length).fill(0);
  for (const key of creatorKeys) {
    const seed = hashString(`${creatorSeed(key)}::${date}::${a.id}`);
    counts[seed % options.length]++;
  }
  return counts;
}
