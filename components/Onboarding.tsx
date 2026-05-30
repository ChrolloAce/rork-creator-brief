"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Onboarding, OnboardingBlock } from "@/lib/db";
import { RichText } from "@/components/RichText";
import { VideoCarousel } from "@/components/VideoCarousel";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-accent text-sm tracking-tight" aria-label={`${n} stars`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      <span className="text-line/30">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) {
    return (
      <iframe
        className="w-full aspect-video border-2 border-line rounded-md bg-black"
        src={`https://www.youtube.com/embed/${yt[1]}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/api/uploads")) {
    return (
      <video
        src={url}
        controls
        playsInline
        className="w-full max-h-[60vh] border-2 border-line rounded-md bg-black"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex border-2 border-line bg-accent text-accent-ink px-3 py-2 rounded-md nb-press text-sm font-black uppercase tracking-widest"
    >
      Watch video ↗
    </a>
  );
}

function Block({
  block,
  answer,
  onAnswer,
}: {
  block: OnboardingBlock;
  answer: unknown;
  onAnswer: (v: unknown) => void;
}) {
  if (block.kind === "text") {
    return <RichText html={block.text} />;
  }
  if (block.kind === "image") {
    if (!block.url) return null;
    return (
      <figure className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.url}
          alt={block.caption ?? ""}
          className="w-full h-auto border-2 border-line rounded-md bg-paper"
        />
        {block.caption && (
          <figcaption className="text-sm text-muted text-center">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.kind === "video") {
    if (!block.url) return null;
    return (
      <div className="space-y-2">
        <VideoEmbed url={block.url} />
        {block.caption && (
          <p className="text-sm text-muted text-center">{block.caption}</p>
        )}
      </div>
    );
  }
  if (block.kind === "videos") {
    if (block.videos.length === 0) return null;
    return (
      <div className="space-y-2">
        {block.heading && (
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            {block.heading}
          </div>
        )}
        <VideoCarousel videos={block.videos} />
      </div>
    );
  }
  if (block.kind === "reviews") {
    const showCard = block.showCard !== false && !!block.appName;
    if (!showCard && block.reviews.length === 0) return null;
    return (
      <div className="space-y-4">
        {showCard && (
          <div className="border-2 border-line bg-background rounded-md nb-shadow p-4 flex items-center gap-4">
            {block.appIcon && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={block.appIcon}
                alt=""
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-line bg-paper shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-lg sm:text-xl font-black leading-tight truncate">
                {block.appName}
              </div>
              {block.appSubtitle && (
                <div className="text-sm text-muted truncate">
                  {block.appSubtitle}
                </div>
              )}
              {!!block.appRating && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Stars n={Math.round(block.appRating)} />
                  <span className="text-sm font-black">
                    {block.appRating.toFixed(1)}
                  </span>
                  {block.appRatingCount ? (
                    <span className="text-xs text-muted">
                      · {block.appRatingCount.toLocaleString()} ratings
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
        {block.reviews.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {block.reviews.map((r, i) => (
          <div
            key={i}
            className="border-2 border-line bg-paper rounded-md nb-shadow-sm p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <Stars n={r.rating} />
              <span className="text-[11px] font-bold text-muted truncate">
                {r.author}
              </span>
            </div>
            {r.title && <div className="font-black leading-tight">{r.title}</div>}
            <p className="text-sm text-ink leading-relaxed">{r.body}</p>
          </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  // question
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-black flex items-center gap-1">
        {block.label || "Question"}
        {block.required && <span className="text-accent">*</span>}
      </span>
      {block.field === "long" ? (
        <textarea
          value={(answer as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          rows={4}
          placeholder={block.placeholder}
          className="w-full border-2 border-line rounded-md px-3 py-2 text-base focus:outline-none focus:border-accent bg-background leading-relaxed"
        />
      ) : block.field === "select" ? (
        <select
          value={(answer as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          className="w-full border-2 border-line rounded-md px-3 py-2 text-base font-bold bg-background focus:outline-none focus:border-accent"
        >
          <option value="">Choose…</option>
          {(block.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : block.field === "checkbox" ? (
        <span className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!answer}
            onChange={(e) => onAnswer(e.target.checked)}
            className="w-5 h-5"
          />
          <span className="text-sm text-ink-soft">{block.placeholder || "Yes"}</span>
        </span>
      ) : (
        <input
          type="text"
          value={(answer as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder={block.placeholder}
          className="w-full border-2 border-line rounded-md px-3 py-2 text-base focus:outline-none focus:border-accent bg-background"
        />
      )}
    </label>
  );
}

export function OnboardingFlow({
  onboarding,
  brief,
}: {
  onboarding: Onboarding;
  brief: { slug: string; name: string; logoUrl: string | null };
}) {
  const router = useRouter();
  const steps = onboarding.steps;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const step = steps[i];
  const mainRef = useRef<HTMLDivElement>(null);
  // Jump back to the top of the scroll area whenever the step changes.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [i]);
  const isLast = i === steps.length - 1;

  // Block any required question on this step that's unanswered.
  const blocked = step.blocks.some(
    (b) =>
      b.kind === "question" &&
      b.required &&
      (answers[b.id] === undefined ||
        answers[b.id] === "" ||
        answers[b.id] === false)
  );

  function next() {
    if (blocked) return;
    if (isLast) {
      router.push(`/b/${brief.slug}`);
    } else {
      setI((n) => Math.min(steps.length - 1, n + 1));
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-background text-ink overflow-hidden">
      <header className="shrink-0 border-b-2 border-line bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 border-2 border-line bg-background rounded-md overflow-hidden flex items-center justify-center shrink-0">
            {brief.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={brief.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs font-black uppercase">{brief.name.slice(0, 2)}</span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            {brief.name} · Onboarding
          </div>
          <div className="ml-auto text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            {i + 1} / {steps.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-paper">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${((i + 1) / steps.length) * 100}%` }}
          />
        </div>
      </header>

      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
          {step.title && (
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              {step.title}
            </h1>
          )}
          {step.subtitle && (
            <p className="text-base sm:text-lg text-ink-soft leading-relaxed -mt-2">
              {step.subtitle}
            </p>
          )}
          {step.blocks.map((b) => (
            <Block
              key={b.id}
              block={b}
              answer={answers[b.id]}
              onAnswer={(v) => setAnswers((a) => ({ ...a, [b.id]: v }))}
            />
          ))}
        </div>
      </main>

      <footer className="shrink-0 border-t-2 border-line bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            className="border-2 border-line bg-background px-4 py-2.5 rounded-md nb-press font-black uppercase tracking-widest text-xs disabled:opacity-30"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={blocked}
            className="ml-auto border-2 border-line bg-accent text-accent-ink px-6 py-2.5 rounded-md nb-press font-black uppercase tracking-widest text-xs disabled:opacity-40"
          >
            {isLast ? "Enter the brief →" : "Next →"}
          </button>
        </div>
      </footer>
    </div>
  );
}
