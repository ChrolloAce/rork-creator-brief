"use client";

import type { VideoExample } from "@/lib/types";
import { getAnalysis } from "@/lib/analyses";

function formatViews(n?: number) {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function VideoChip({
  video,
  fallbackId,
  onRemove,
}: {
  video?: VideoExample;
  fallbackId?: string;
  onRemove: () => void;
}) {
  // Unknown video (ID pinned but not in the local pool)
  if (!video) {
    return (
      <div className="shrink-0 w-[150px] border-2 border-line rounded-md bg-paper p-2 flex flex-col gap-1">
        <div className="h-[180px] bg-background border-2 border-line rounded-sm flex items-center justify-center text-[10px] text-muted p-2 text-center">
          Unknown ID<br />(not in pool)
        </div>
        <div className="font-mono text-[10px] text-muted break-all line-clamp-2">
          {fallbackId}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="border-2 border-line bg-background text-xs font-black uppercase tracking-widest px-2 py-1 rounded-sm nb-press"
        >
          × Remove
        </button>
      </div>
    );
  }

  const views = formatViews(video.views);
  const hasAnalysis = video.dbId ? !!getAnalysis(video.dbId) : false;

  return (
    <div className="shrink-0 w-[150px] border-2 border-line rounded-md bg-background nb-shadow-sm overflow-hidden flex flex-col">
      <a
        href={video.url}
        target="_blank"
        rel="noreferrer"
        className="block relative aspect-[9/16] bg-paper group"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail}
          alt={video.caption ?? ""}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span className="absolute top-1 left-1 text-[9px] font-black uppercase tracking-widest bg-background text-ink px-1 py-0.5 border-2 border-line rounded-sm">
          {video.platform === "instagram" ? "IG" : video.platform === "tiktok" ? "TT" : video.platform}
        </span>
        {views && (
          <span className="absolute top-1 right-1 text-[9px] font-black uppercase tracking-widest bg-accent text-accent-ink px-1 py-0.5 border-2 border-line rounded-sm">
            {views}
          </span>
        )}
        {hasAnalysis && (
          <span className="absolute bottom-8 left-1 text-[9px] font-black uppercase tracking-widest bg-ink text-background px-1 py-0.5 border-2 border-line rounded-sm">
            T ✓
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 py-1">
          <span className="block text-white font-bold text-[11px] leading-tight truncate">
            {video.creator}
          </span>
        </span>
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </a>
      {video.caption && (
        <div className="p-1.5 text-[10px] text-ink leading-snug line-clamp-2 border-t-2 border-line">
          {video.caption}
        </div>
      )}
      <div className="flex gap-1 p-1.5 border-t-2 border-line">
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="flex-1 text-center border-2 border-line bg-background text-[10px] font-black uppercase tracking-widest py-1 rounded-sm nb-press"
        >
          Open ↗
        </a>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="border-2 border-line bg-background px-2 text-sm font-black rounded-sm nb-press"
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}
