"use client";

import { useEffect, useMemo, useState } from "react";
import type { HookVideo } from "@/lib/hook-videos";
import { t, type Lang } from "@/lib/i18n";

function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function Chip({
  children,
  tone = "paper",
}: {
  children: React.ReactNode;
  tone?: "paper" | "accent" | "ink";
}) {
  const cls =
    tone === "accent"
      ? "bg-accent text-accent-ink"
      : tone === "ink"
        ? "bg-ink text-background"
        : "bg-paper text-ink";
  return (
    <span
      className={`inline-block text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 border-2 border-line rounded-sm leading-none ${cls}`}
    >
      {children}
    </span>
  );
}

type Sort = "views" | "newest";

export function HooksView({
  videos,
  lang = "en",
}: {
  videos: HookVideo[];
  lang?: Lang;
}) {
  const accounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of videos) m.set(v.account, (m.get(v.account) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [videos]);
  const [account, setAccount] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("views");
  const [open, setOpen] = useState<HookVideo | null>(null);

  const list = useMemo(() => {
    const filtered = account ? videos.filter((v) => v.account === account) : videos;
    const arr = [...filtered];
    if (sort === "newest") {
      arr.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
    } else {
      arr.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    }
    return arr;
  }, [videos, account, sort]);

  const totalViews = useMemo(
    () => list.reduce((s, v) => s + (v.views ?? 0), 0),
    [list]
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          {t(lang, "hooks")}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
          {t(lang, "hooks")}
        </h1>
        <p className="text-base sm:text-lg leading-relaxed text-ink-soft max-w-2xl">
          {t(lang, "hooksIntro")}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip tone="ink">
            {list.length} {t(lang, "videosWordLower")}
          </Chip>
          {totalViews > 0 && <Chip tone="accent">{compact(totalViews)} views</Chip>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-2 border-line bg-paper rounded-md p-3 nb-shadow-sm">
        <FilterButton active={account === null} onClick={() => setAccount(null)}>
          {t(lang, "allAccounts")}
        </FilterButton>
        {accounts.map(([a, n]) => (
          <FilterButton key={a} active={account === a} onClick={() => setAccount(a)}>
            @{a} <span className="opacity-60">· {n}</span>
          </FilterButton>
        ))}
        <span className="flex-1" />
        <FilterButton active={sort === "views"} onClick={() => setSort("views")}>
          {t(lang, "sortViews")}
        </FilterButton>
        <FilterButton active={sort === "newest"} onClick={() => setSort("newest")}>
          {t(lang, "sortNewest")}
        </FilterButton>
      </div>

      {list.length === 0 ? (
        <p className="text-muted">{t(lang, "hooksEmpty")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {list.map((v) => (
            <HookCard key={v.id} video={v} onOpen={setOpen} />
          ))}
        </div>
      )}

      {open && <HookModal video={open} lang={lang} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1.5 border-2 border-line rounded-md nb-press ${
        active ? "bg-ink text-background" : "bg-background text-ink hover:bg-paper"
      }`}
    >
      {children}
    </button>
  );
}

export function HookCard({
  video,
  onOpen,
}: {
  video: HookVideo;
  onOpen: (v: HookVideo) => void;
}) {
  const views = compact(video.views);
  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      className="group block w-full text-left border-2 border-line rounded-md nb-shadow-sm overflow-hidden bg-background nb-press"
      aria-label={`Play: @${video.account} — ${video.caption ?? video.shortcode}`}
    >
      <div className="relative aspect-[9/16] bg-paper overflow-hidden">
        {video.thumbUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={video.thumbUrl}
            alt={video.caption ?? `@${video.account}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <video
            src={video.videoUrl}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        )}
        <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-widest bg-background text-ink px-1.5 py-0.5 border-2 border-line rounded-sm leading-none">
          IG
        </span>
        {views && (
          <span className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest bg-accent text-accent-ink px-1.5 py-0.5 border-2 border-line rounded-sm leading-none">
            {views}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="w-12 h-12 rounded-full bg-background border-2 border-line flex items-center justify-center font-black text-lg nb-shadow-sm">
            ▶
          </span>
        </span>
        <span className="absolute inset-x-0 bottom-0 px-2 py-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
          <span className="block text-white font-bold text-xs leading-tight">
            @{video.account}
          </span>
        </span>
      </div>
      {video.caption && (
        <div className="p-2.5 border-t-2 border-line">
          <p className="text-xs text-ink leading-snug line-clamp-2">{video.caption}</p>
        </div>
      )}
    </button>
  );
}

export function HookModal({
  video,
  lang,
  onClose,
}: {
  video: HookVideo;
  lang: Lang;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const posted = video.postedAt
    ? new Date(video.postedAt).toLocaleDateString(lang === "es" ? "es" : "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={video.caption ?? `@${video.account}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-ink/60 cursor-default"
      />
      <div className="relative w-full max-w-4xl bg-background border-2 border-line rounded-none sm:rounded-md nb-shadow min-h-screen sm:min-h-0 sm:my-8 flex flex-col md:flex-row">
        <div className="md:w-[360px] shrink-0 bg-ink flex items-center justify-center">
          <video
            src={video.videoUrl}
            poster={video.thumbUrl ?? undefined}
            controls
            autoPlay
            playsInline
            className="w-full max-h-[80vh] aspect-[9/16] object-contain"
          />
        </div>
        <div className="flex-1 min-w-0 p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
                Instagram
              </div>
              <a
                href={`https://instagram.com/${video.account}`}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-black text-ink hover:text-accent"
              >
                @{video.account}
              </a>
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
          <div className="flex flex-wrap gap-2">
            {video.views !== null && <Chip tone="accent">{compact(video.views)} views</Chip>}
            {video.likes !== null && <Chip>{compact(video.likes)} likes</Chip>}
            {video.comments !== null && <Chip>{compact(video.comments)} comments</Chip>}
            {video.duration !== null && <Chip>{Math.round(video.duration)}s</Chip>}
            {posted && <Chip>{posted}</Chip>}
          </div>
          {video.caption && (
            <p className="text-sm sm:text-base leading-relaxed text-ink whitespace-pre-line border-2 border-line bg-paper rounded-md p-3">
              {video.caption}
            </p>
          )}
          <div className="mt-auto pt-2">
            <a
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center border-2 border-line bg-ink text-background font-black uppercase tracking-wider text-sm py-3 rounded-md nb-press"
            >
              {t(lang, "watchOn")} Instagram ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
