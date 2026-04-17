"use client";

import { useMemo, useState } from "react";
import type { VideoExample } from "@/lib/types";
import { allVideos } from "@/lib/all-videos";

function formatViews(n?: number) {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// ~9k-line import is heavy; render only what matches.
export function VideoPicker({
  excludedIds,
  onPick,
  placeholder = "Search by creator or caption…",
}: {
  excludedIds: Set<string>;
  onPick: (v: VideoExample) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    const out: VideoExample[] = [];
    for (const v of allVideos) {
      if (v.dbId && excludedIds.has(v.dbId)) continue;
      const hay =
        (v.creator + " " + (v.caption ?? "") + " " + v.id).toLowerCase();
      if (hay.includes(needle)) {
        out.push(v);
        if (out.length >= 60) break;
      }
    }
    return out;
  }, [q, excludedIds]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            className="border-2 border-line bg-background font-black uppercase tracking-widest px-2 py-1.5 rounded-md nb-press text-xs"
          >
            Clear
          </button>
        )}
      </div>
      {open && q && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 border-2 border-line bg-background nb-shadow rounded-md max-h-[360px] overflow-y-auto">
          {results.length === 0 && (
            <p className="p-3 text-xs text-muted">No matches.</p>
          )}
          {results.map((v) => (
            <button
              key={v.dbId}
              type="button"
              onClick={() => {
                onPick(v);
                setQ("");
                setOpen(false);
              }}
              className="w-full text-left flex items-start gap-2 p-2 border-b-2 border-line last:border-b-0 hover:bg-paper"
            >
              <span className="w-10 h-12 border-2 border-line bg-paper rounded-sm overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-black text-xs text-ink truncate">
                    {v.creator}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-accent text-accent-ink px-1 py-0.5 border border-line rounded-sm">
                    {v.platform === "instagram" ? "IG" : v.platform === "tiktok" ? "TT" : v.platform}
                  </span>
                  {v.views ? (
                    <span className="text-[10px] font-bold text-muted ml-auto">
                      {formatViews(v.views)}
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs text-ink-soft line-clamp-1">
                  {v.caption ?? v.id}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
