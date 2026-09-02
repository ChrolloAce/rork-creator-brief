"use client";

import { useMemo, useState } from "react";
import type { AutoRotation } from "@/lib/db";
import { autoDaysForCreator, type RotationCreator } from "@/lib/rotation";

// Hand the calendar a pool of scripts and a date range; every creator is dealt
// their own order. No days to build, no per-creator state stored — the order
// comes from the creator's id, so it is stable on refresh and different from
// the next person's.

type FormatOption = { slug: string; title: string };

function prettyShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function AutoRotationPanel({
  value,
  formats,
  scriptGroups,
  creators,
  requireLogin,
  onChange,
}: {
  value: AutoRotation | undefined;
  formats: FormatOption[];
  scriptGroups: { id: string; name: string; slugs: string[] }[];
  creators: RotationCreator[];
  requireLogin: boolean;
  onChange: (next: AutoRotation | undefined) => void;
}) {
  // Memoised so the preview below doesn't recompute on every render just
  // because the default object is rebuilt.
  const cfg: AutoRotation = useMemo(
    () =>
      value ?? {
        enabled: false,
        slugs: [],
        start: new Date().toISOString().slice(0, 10),
        days: 30,
        perDay: 1,
        cadence: "daily",
      },
    [value]
  );
  const [open, setOpen] = useState(!!value?.enabled);

  const titleOf = useMemo(() => {
    const m = new Map(formats.map((f) => [f.slug, f.title]));
    return (slug: string) => m.get(slug) ?? slug;
  }, [formats]);

  function patch(p: Partial<AutoRotation>) {
    onChange({ ...cfg, ...p });
  }

  // Real creators when the roster has them, otherwise stand-ins so the preview
  // still shows how differently four people would be dealt.
  const sample = useMemo(() => {
    // Deduped by userId: a roster can hold several rows for one account, and
    // showing the same person twice makes the rotation look broken when both
    // columns are (correctly) identical.
    const seen = new Set<string>();
    const real = creators
      .filter((c) => c.userId && !seen.has(c.userId) && seen.add(c.userId))
      .slice(0, 4);
    if (real.length > 0) return real.map((c) => ({ name: c.name, key: c.userId! }));
    return ["Creator A", "Creator B", "Creator C", "Creator D"].map((n) => ({
      name: n,
      key: n.toLowerCase().replace(/\s+/g, "-"),
    }));
  }, [creators]);

  // Previews as soon as a pool is picked, whether or not the rotation is live.
  // `enabled` is a publishing switch, not a prerequisite for looking at what
  // you are about to publish.
  const preview = useMemo(() => {
    if (cfg.slugs.length === 0) return [];
    return sample.map((s) => ({
      name: s.name,
      days: autoDaysForCreator(
        { ...cfg, enabled: true, days: Math.min(cfg.days, 5) },
        s.key
      ),
    }));
  }, [cfg, sample]);

  const cycleDays = cfg.slugs.length
    ? Math.floor(cfg.slugs.length / Math.max(1, cfg.perDay))
    : 0;

  return (
    <div className="border-2 border-line bg-background rounded-md nb-shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold text-muted"
      >
        <span>
          🎲 Auto-rotate · every creator gets their own order
          {cfg.enabled && cfg.slugs.length > 0 && (
            <span className="text-accent"> · on</span>
          )}
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t-2 border-line pt-3 space-y-3">
          <p className="text-xs text-muted">
            Pick a pool of scripts and a date range. Each creator is dealt the whole
            pool in their own order, so nobody films the same script on the same day
            and nobody repeats until the pool runs out. Any day you build by hand
            still overrides the rotation for that date.
          </p>

          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={!!cfg.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
              className="w-4 h-4 accent-[#f97316]"
            />
            Rotation is live on the public calendar
          </label>

          {!requireLogin && cfg.enabled && (
            <p className="text-[11px] font-bold text-[#b91c1c]">
              This brief uses a shared access code, so there is no per-person login to
              rotate on. Everyone will be dealt the same order until you switch the
              brief to creator logins.
            </p>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
              Pool
            </div>
            <select
              value={cfg.groupId ?? ""}
              onChange={(e) => {
                const g = scriptGroups.find((x) => x.id === e.target.value);
                patch({
                  groupId: g?.id,
                  slugs: g ? g.slugs : formats.map((f) => f.slug),
                });
              }}
              className="w-full border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
            >
              <option value="">Every script in this brief ({formats.length})</option>
              {scriptGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.slugs.length})
                </option>
              ))}
            </select>
            <p className="text-[10px] font-bold text-muted mt-1">
              {cfg.slugs.length} scripts in the pool
              {cycleDays > 0 && ` · a creator repeats after ${cycleDays} days`}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-1">
                Starts
              </span>
              <input
                type="date"
                value={cfg.start}
                onChange={(e) => e.target.value && patch({ start: e.target.value })}
                className="w-full border-2 border-line bg-background rounded-sm px-2 py-1 text-xs font-bold"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-1">
                For (days)
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={cfg.days}
                onChange={(e) => patch({ days: Number(e.target.value) || 1 })}
                className="w-full border-2 border-line bg-background rounded-sm px-2 py-1 text-xs font-bold"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-1">
                Per day
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={cfg.perDay}
                onChange={(e) => patch({ perDay: Number(e.target.value) || 1 })}
                className="w-full border-2 border-line bg-background rounded-sm px-2 py-1 text-xs font-bold"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-1">
                Cadence
              </span>
              <select
                value={cfg.cadence ?? "daily"}
                onChange={(e) =>
                  patch({ cadence: e.target.value as "daily" | "weekdays" })
                }
                className="w-full border-2 border-line bg-background rounded-sm px-2 py-1 text-xs font-bold"
              >
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays only</option>
              </select>
            </label>
          </div>

          {preview.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
                What the first days look like
                {!cfg.enabled && (
                  <span className="text-accent"> · preview only, not live yet</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-2 border-line">
                  <thead>
                    <tr className="bg-paper">
                      <th className="text-left font-black px-2 py-1 border-b-2 border-line">
                        Day
                      </th>
                      {preview.map((p) => (
                        <th
                          key={p.name}
                          className="text-left font-black px-2 py-1 border-b-2 border-line whitespace-nowrap"
                        >
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview[0].days.map((d, i) => (
                      <tr key={d.date} className={i % 2 ? "bg-paper/60" : ""}>
                        <td className="px-2 py-1 font-bold whitespace-nowrap align-top">
                          {prettyShort(d.date)}
                        </td>
                        {preview.map((p) => (
                          <td key={p.name} className="px-2 py-1 align-top">
                            {(p.days[i]?.assignments ?? []).map((a) => (
                              <span key={a.id} className="block leading-tight">
                                {titleOf(a.formatSlug ?? "")}
                              </span>
                            ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] font-bold text-muted mt-1">
                {creators.filter((c) => c.userId).length > 0
                  ? "Real creators from your roster."
                  : "Stand-in names — your roster has no logged-in creators yet."}
              </p>
            </div>
          )}

          {cfg.enabled && cfg.slugs.length === 0 && (
            <p className="text-[11px] font-bold text-[#b91c1c]">
              The pool is empty, so nothing will be dealt. Pick a group above.
            </p>
          )}

          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest text-[#b91c1c] hover:bg-[#fee2e2]"
            >
              🗑 Remove rotation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
