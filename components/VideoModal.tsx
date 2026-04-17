"use client";

import { useEffect } from "react";
import type { VideoExample } from "@/lib/types";
import type { VideoAnalysis } from "@/lib/analyses";

const platformLabel: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X / Twitter",
  youtube: "YouTube",
};

function formatViews(n?: number) {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "muted";
}) {
  const toneCls =
    tone === "accent"
      ? "bg-accent text-accent-ink"
      : tone === "muted"
        ? "bg-paper text-muted"
        : "bg-background text-ink";
  return (
    <span
      className={`inline-flex items-center border-2 border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm ${toneCls}`}
    >
      {children}
    </span>
  );
}

export function VideoModal({
  video,
  analysis,
  onClose,
}: {
  video: VideoExample;
  analysis?: VideoAnalysis;
  onClose: () => void;
}) {
  // Close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const views = formatViews(video.views);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${video.creator} — breakdown`}
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-ink/60 cursor-default"
      />

      {/* Content */}
      <div className="relative w-full max-w-3xl bg-background border-2 border-line rounded-none sm:rounded-md nb-shadow min-h-screen sm:min-h-0 sm:my-8">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background border-b-2 border-line p-4 sm:p-5 flex items-start gap-3">
          {/* Thumb */}
          <div className="w-16 h-20 sm:w-20 sm:h-24 border-2 border-line bg-paper rounded-sm overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnail}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Chip tone="accent">{platformLabel[video.platform] ?? video.platform}</Chip>
              {views && <Chip>{views} views</Chip>}
              {!analysis && <Chip tone="muted">No transcript yet</Chip>}
            </div>
            <a
              href={video.creatorUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-black text-ink hover:text-accent"
            >
              {video.creator} ↗
            </a>
            {video.caption && (
              <p className="text-xs text-ink-soft mt-1 leading-snug line-clamp-2">
                {video.caption}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 border-2 border-line bg-background rounded-md flex items-center justify-center font-black nb-press shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {analysis ? (
            <>
              {analysis.hook && (
                <section className="border-2 border-line bg-accent text-accent-ink rounded-md p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2">
                    The hook
                  </div>
                  <p className="leading-relaxed font-semibold">{analysis.hook}</p>
                </section>
              )}

              {analysis.summary && (
                <section>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                    Summary
                  </div>
                  <p className="text-ink leading-relaxed">{analysis.summary}</p>
                </section>
              )}

              <section className="grid gap-3 sm:grid-cols-2">
                {analysis.tone && (
                  <div className="border-2 border-line bg-background rounded-md p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
                      Tone
                    </div>
                    <div className="text-sm text-ink">{analysis.tone}</div>
                  </div>
                )}
                {analysis.pacing && (
                  <div className="border-2 border-line bg-background rounded-md p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
                      Pacing
                    </div>
                    <div className="text-sm text-ink">{analysis.pacing}</div>
                  </div>
                )}
              </section>

              {analysis.whatWorked.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                    What worked
                  </div>
                  <ul className="space-y-2">
                    {analysis.whatWorked.map((w, i) => (
                      <li key={i} className="flex gap-2 text-ink">
                        <span className="text-accent font-black shrink-0">✓</span>
                        <span className="leading-relaxed">{w}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {analysis.segments.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                    Script — timestamped
                  </div>
                  <ol className="space-y-2">
                    {analysis.segments.map((s, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="shrink-0 font-mono text-xs font-bold border-2 border-line bg-paper px-1.5 py-0.5 rounded-sm min-w-[50px] text-center">
                          {s.timestamp}
                        </span>
                        <span className="text-sm text-ink leading-relaxed pt-0.5">
                          {s.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {analysis.suggestions.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                    How to recreate it (suggestions)
                  </div>
                  <ul className="space-y-2">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i} className="flex gap-2 text-ink-soft">
                        <span className="text-accent font-black shrink-0">→</span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {analysis.topics.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                    Topics
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.topics.map((t, i) => (
                      <Chip key={i}>{t}</Chip>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="border-2 border-line bg-paper rounded-md p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                Transcript + insights
              </div>
              <p className="text-ink leading-relaxed">
                This video hasn&rsquo;t been analyzed yet — Instagram
                rate-limited the transcript pull. Ask Ernesto to re-run the
                batch and the breakdown will appear here automatically.
              </p>
            </section>
          )}

          {/* Footer with external link */}
          <div className="sticky bottom-0 bg-background pt-4 -mx-4 sm:-mx-6 px-4 sm:px-6 border-t-2 border-line">
            <a
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center border-2 border-line bg-ink text-background font-black uppercase tracking-wider text-sm py-3 rounded-md nb-press"
            >
              Watch on {platformLabel[video.platform] ?? video.platform} ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
