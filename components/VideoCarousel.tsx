"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoExample } from "@/lib/types";
import { getAnalysis } from "@/lib/analyses";
import { VideoCard } from "./VideoCard";
import { VideoModal } from "./VideoModal";

export function VideoCarousel({ videos }: { videos: VideoExample[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [active, setActive] = useState<VideoExample | null>(null);

  const updateButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [updateButtons, videos.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.85, 200);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  if (videos.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10"
        style={{ scrollbarWidth: "thin" }}
        role="region"
        aria-label="Top-performing examples carousel"
        tabIndex={0}
      >
        {videos.map((v) => {
          const analysis = v.dbId ? getAnalysis(v.dbId) : undefined;
          return (
            <div
              key={v.url}
              className="snap-start shrink-0 w-[160px] sm:w-[180px] md:w-[200px]"
            >
              <VideoCard
                video={v}
                hasAnalysis={!!analysis}
                onOpen={setActive}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(-1)}
        disabled={!canPrev}
        aria-label="Previous videos"
        className={`hidden md:flex absolute left-0 top-[38%] -translate-y-1/2 -translate-x-3 w-10 h-10 items-center justify-center border-2 border-line bg-background rounded-md nb-shadow-sm transition-opacity ${
          canPrev
            ? "opacity-100 nb-press cursor-pointer"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <span className="sr-only">Previous</span>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M9 1L3 7L9 13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="square" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        disabled={!canNext}
        aria-label="Next videos"
        className={`hidden md:flex absolute right-0 top-[38%] -translate-y-1/2 translate-x-3 w-10 h-10 items-center justify-center border-2 border-line bg-background rounded-md nb-shadow-sm transition-opacity ${
          canNext
            ? "opacity-100 nb-press cursor-pointer"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <span className="sr-only">Next</span>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M5 1L11 7L5 13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="square" />
        </svg>
      </button>

      {active && (
        <VideoModal
          video={active}
          analysis={active.dbId ? getAnalysis(active.dbId) : undefined}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
