"use client";

import { useEffect, useState } from "react";

type VtProject = {
  id: string;
  name: string;
  accountCount: number;
  videoCount: number;
};

export function ProjectSources({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [projects, setProjects] = useState<VtProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vt-projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setProjects(j.projects as VtProject[]);
        else setError(j.error ?? "Failed to load projects");
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          ViewTrack sources ({value.length} selected)
        </div>
      </div>
      <p className="text-xs text-muted mb-3">
        Pick the projects this brief draws videos from. The picker below will
        filter these live.{" "}
        {value.length === 0
          ? "None selected = fall back to the built-in Rork Research pool."
          : ""}
      </p>
      {error && (
        <p className="text-xs text-[#b91c1c] font-bold mb-2">{error}</p>
      )}
      {!projects ? (
        <p className="text-xs text-muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="text-xs text-muted italic">
          No projects available on this ViewTrack account.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => {
            const active = value.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`border-2 border-line rounded-md px-3 py-1.5 nb-press text-xs font-bold flex items-center gap-2 ${
                  active
                    ? "bg-accent text-accent-ink"
                    : "bg-background text-ink"
                }`}
              >
                <span
                  className={`w-3 h-3 border-2 border-line rounded-sm ${active ? "bg-ink" : "bg-background"}`}
                  aria-hidden
                />
                <span>{p.name}</span>
                <span
                  className={`text-[10px] ${active ? "text-accent-ink/70" : "text-muted"}`}
                >
                  {p.videoCount}v
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
