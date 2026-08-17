"use client";

import type { Platform, VideoExample } from "@/lib/types";
import { thumbSrc } from "@/lib/thumb";

const platformLabel: Record<Platform, string> = {
  instagram: "IG",
  tiktok: "TT",
  x: "X",
  youtube: "YT",
};

function formatViews(n?: number) {
  if (n === undefined || n === null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function VideoCard({
  video,
  onOpen,
}: {
  video: VideoExample;
  onOpen: (video: VideoExample) => void;
}) {
  const views = formatViews(video.views);
  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      className="group block w-full text-left border-2 border-line rounded-md nb-shadow-sm overflow-hidden bg-background nb-press"
      aria-label={`Open breakdown: ${video.creator} — ${video.caption ?? video.platform}`}
    >
      <div className="relative aspect-[9/16] bg-paper overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbSrc(video.thumbnail, video.url)}
          alt={video.caption ?? `${video.creator} on ${video.platform}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-widest bg-background text-ink px-1.5 py-0.5 border-2 border-line rounded-sm leading-none">
          {platformLabel[video.platform]}
        </span>
        {views && (
          <span className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest bg-accent text-accent-ink px-1.5 py-0.5 border-2 border-line rounded-sm leading-none">
            {views} views
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 px-2 py-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
          <span className="block text-white font-bold text-xs leading-tight">
            {video.creator}
          </span>
        </span>
      </div>
      {video.caption && (
        <div className="p-2.5 border-t-2 border-line">
          <p className="text-xs text-ink leading-snug line-clamp-2">
            {video.caption}
          </p>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted mt-1.5 group-hover:text-accent transition-colors">
            Breakdown →
          </p>
        </div>
      )}
    </button>
  );
}
