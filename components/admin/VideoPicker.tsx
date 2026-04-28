"use client";

import { useEffect, useMemo, useState } from "react";
import type { VideoExample } from "@/lib/types";
import { allVideos } from "@/lib/all-videos";

function formatViews(n?: number) {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

type PickerSource = "static" | "vt";
type SortKey = "views" | "likes" | "recent" | "comments";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "recent", label: "Recent" },
];

function sortKey(sort: SortKey, v: VideoExample): number {
  if (sort === "views") return v.views ?? 0;
  if (sort === "likes") return v.likes ?? 0;
  if (sort === "comments") return v.comments ?? 0;
  // recent
  return v.uploadDate ? new Date(v.uploadDate).getTime() : 0;
}

export function VideoPicker({
  excludedIds,
  scopedProjectIds,
  onPick,
  placeholder = "Search @creator or caption…",
}: {
  excludedIds: Set<string>;
  scopedProjectIds?: string[];
  onPick: (v: VideoExample) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("views");
  const [pool, setPool] = useState<VideoExample[] | null>(null);
  const [source, setSource] = useState<PickerSource>("static");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the pool: VT scoped projects override the static pool.
  useEffect(() => {
    let cancelled = false;
    const scoped = scopedProjectIds?.filter(Boolean) ?? [];
    if (scoped.length === 0) {
      setPool(allVideos);
      setSource("static");
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSource("vt");
    const url = `/api/vt-search?projects=${encodeURIComponent(scoped.join(","))}`;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setPool(j.videos as VideoExample[]);
        else setError(j.error ?? "ViewTrack error");
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopedProjectIds?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    if (!pool) return [];
    const needle = q.trim().toLowerCase();
    const base = needle
      ? pool.filter((v) => {
          if (v.dbId && excludedIds.has(v.dbId)) return false;
          const hay = (
            v.creator +
            " " +
            (v.caption ?? "") +
            " " +
            v.id
          ).toLowerCase();
          return hay.includes(needle);
        })
      : pool.filter((v) => !(v.dbId && excludedIds.has(v.dbId)));
    return [...base].sort((a, b) => sortKey(sort, b) - sortKey(sort, a));
  }, [pool, q, excludedIds, sort]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-[160px] border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="border-2 border-line bg-background font-black uppercase tracking-widest px-2 py-1.5 rounded-md nb-press text-xs"
          >
            Clear
          </button>
        )}
        <span className="text-[10px] font-black uppercase tracking-widest text-muted whitespace-nowrap">
          {loading
            ? "Loading…"
            : error
              ? "err"
              : `${results.length} ${source === "vt" ? "live" : "pool"}`}
        </span>
      </div>
      <div className="flex gap-1 items-center flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mr-1">
          Sort
        </span>
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSort(opt.key)}
              className={`border-2 border-line rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                active
                  ? "bg-ink text-background"
                  : "bg-background text-ink nb-press"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-[#b91c1c] font-bold">
          {error}
        </p>
      )}
      {!loading && pool && (
        <div
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth -mx-1 px-1"
          role="listbox"
        >
          {results.length === 0 ? (
            <p className="text-xs text-muted italic px-2 py-4">
              {q
                ? "No matches."
                : source === "vt"
                  ? "Pick a source project to load videos."
                  : "Type to search the pool."}
            </p>
          ) : (
            results.map((v) => (
              <button
                key={v.dbId ?? v.url}
                type="button"
                onClick={() => onPick(v)}
                className="snap-start shrink-0 w-[160px] border-2 border-line rounded-md bg-background nb-shadow-sm overflow-hidden nb-press"
                title={v.caption}
              >
                <div className="relative aspect-[9/16] bg-paper overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-1 left-1 text-[9px] font-black uppercase tracking-widest bg-background text-ink px-1 py-0.5 border-2 border-line rounded-sm">
                    {v.platform === "instagram"
                      ? "IG"
                      : v.platform === "tiktok"
                        ? "TT"
                        : v.platform}
                  </span>
                  {(() => {
                    const metric =
                      sort === "likes"
                        ? v.likes
                        : sort === "comments"
                          ? v.comments
                          : sort === "recent"
                            ? undefined
                            : v.views;
                    const label =
                      sort === "likes"
                        ? "♥"
                        : sort === "comments"
                          ? "💬"
                          : "";
                    if (sort === "recent" && v.uploadDate) {
                      const d = new Date(v.uploadDate);
                      const mo = d.toLocaleString("en", { month: "short" });
                      return (
                        <span className="absolute top-1 right-1 text-[9px] font-black uppercase tracking-widest bg-accent text-accent-ink px-1 py-0.5 border-2 border-line rounded-sm">
                          {mo} {d.getDate()}
                        </span>
                      );
                    }
                    if (!metric) return null;
                    return (
                      <span className="absolute top-1 right-1 text-[9px] font-black uppercase tracking-widest bg-accent text-accent-ink px-1 py-0.5 border-2 border-line rounded-sm">
                        {label} {formatViews(metric)}
                      </span>
                    );
                  })()}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 py-1">
                    <span className="block text-white font-bold text-[11px] leading-tight truncate">
                      {v.creator}
                    </span>
                  </span>
                </div>
                {v.caption ? (
                  <div className="p-1.5 text-left text-[10px] text-ink leading-snug line-clamp-2 border-t-2 border-line">
                    {v.caption}
                  </div>
                ) : null}
                <div className="p-1.5 border-t-2 border-line text-center text-[10px] font-black uppercase tracking-widest">
                  + Pin
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
