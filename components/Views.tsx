"use client";

import React, { useState } from "react";
import type {
  Format,
  FormatAsset,
  FormatCaption,
  FormatListItem,
  FormatSectionKey,
  FormatSong,
  Hook,
  HookCategory,
  ListItem,
  ScriptCue,
} from "@/lib/types";
import { CUE_HOW_ICONS, CUE_HOW_LABELS, DEFAULT_SECTION_ORDER } from "@/lib/types";
import {
  formatDuration,
  parseScriptLines,
  resolveCues,
} from "@/lib/script-lines";
import {
  detectSongPlatform,
  songTitleFromUrl,
  SONG_PLATFORM_LABELS,
} from "@/lib/songs";
import { VERSE_BACKGROUNDS, randomBackgroundKey } from "@/lib/verse-styles";
import { t, type Lang, type UIKey } from "@/lib/i18n";
import { InlineRich, RichText } from "@/components/RichText";

// Resolve the effective section order: user's custom order with any
// missing keys appended in default order, invalid keys dropped.
export function effectiveSectionOrder(
  custom: FormatSectionKey[] | undefined
): FormatSectionKey[] {
  if (!custom || custom.length === 0) return DEFAULT_SECTION_ORDER;
  const seen = new Set<FormatSectionKey>();
  const out: FormatSectionKey[] = [];
  for (const k of custom) {
    if (DEFAULT_SECTION_ORDER.includes(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of DEFAULT_SECTION_ORDER) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
import { Thumbnail } from "./Thumbnail";
import { VideoCarousel } from "./VideoCarousel";
import {
  computeSectionStat,
  sanitizeVisibleStats,
  SECTION_STAT_LABELS,
  SECTION_STAT_DEFAULTS,
} from "@/lib/section-stats";

function asItem(i: FormatListItem): ListItem {
  return typeof i === "string" ? { text: i } : i;
}

function visibleItems(items: FormatListItem[]): ListItem[] {
  return items.map(asItem).filter((i) => !i.hidden);
}

function isHidden(format: Format, key: FormatSectionKey): boolean {
  return format.hiddenSections?.includes(key) ?? false;
}

function visibleSongs(songs: FormatSong[] | undefined): FormatSong[] {
  return (songs ?? []).filter((s) => !s.hidden && s.url?.trim());
}

// Every place the same sound lives, deduped, primary link first.
function songLinks(song: FormatSong): string[] {
  const all = [song.url, ...(song.altUrls ?? [])]
    .map((u) => (u ?? "").trim())
    .filter(Boolean);
  return [...new Set(all)];
}

function hasCaption(c: FormatCaption | undefined): boolean {
  if (!c) return false;
  return Boolean(
    c.text?.trim() ||
      c.cta?.trim() ||
      c.note?.trim() ||
      (c.hashtags ?? []).length > 0 ||
      (c.options ?? []).some((o) => o.text?.trim())
  );
}

function ItemRow({
  item,
  badge,
}: {
  item: ListItem;
  badge?: React.ReactNode;
}) {
  return (
    <li className="space-y-3">
      <div className="flex gap-3 items-start">
        {badge}
        <span className="text-ink leading-relaxed pt-0.5 flex-1">
          {item.text}
        </span>
      </div>
      {item.image && (
        <div className="pl-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt=""
            className="block w-full max-w-2xl h-auto border-2 border-line rounded-md bg-paper"
          />
        </div>
      )}
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 border-2 border-line bg-accent text-accent-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm">
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "accent";
}) {
  const toneStyles =
    tone === "success"
      ? "bg-success text-success-ink"
      : tone === "accent"
        ? "bg-accent text-accent-ink"
        : "bg-paper text-ink";
  return (
    <span
      className={`inline-flex items-center border-2 border-line px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest rounded-sm ${toneStyles}`}
    >
      {children}
    </span>
  );
}

// One shot pinned to a script beat: what goes on screen, how, and for how long.
// Renders under the line it belongs to so the creator reads the direction at
// the exact moment they need it, rather than in a separate asset list.
function CueChip({
  cue,
  assets,
  lang = "en",
}: {
  cue: ScriptCue;
  assets: FormatAsset[] | undefined;
  lang?: Lang;
}) {
  const asset = cue.assetUrl
    ? (assets ?? []).find((a) => a.url === cue.assetUrl)
    : undefined;
  const name =
    cue.label?.trim() || asset?.label?.trim() || asset?.filename?.trim() || "";
  const dur = formatDuration(cue.durationSec);
  const isImage = asset?.mime?.startsWith("image/");
  const isVideo = asset?.mime?.startsWith("video/");
  return (
    <div className="border-2 border-line bg-background rounded-sm p-2 flex gap-2 items-start">
      {asset && (isImage || isVideo) ? (
        <span className="shrink-0 w-12 h-12 border-2 border-line rounded-sm overflow-hidden bg-paper flex items-center justify-center">
          {isImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={asset.url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <video
              src={asset.url}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover bg-black"
            />
          )}
        </span>
      ) : (
        <span
          className="shrink-0 w-12 h-12 border-2 border-line rounded-sm bg-paper flex items-center justify-center text-base"
          aria-hidden
        >
          {CUE_HOW_ICONS[cue.how] ?? "\u25a3"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
            {CUE_HOW_LABELS[cue.how] ?? cue.how}
          </span>
          <span className="text-[10px] font-bold text-ink">
            {dur ? `${t(lang, "showFor")} ${dur}` : t(lang, "untilNextBeat")}
          </span>
        </div>
        {name && (
          <div className="text-sm font-bold text-ink truncate">{name}</div>
        )}
        {cue.note && (
          <p className="text-xs text-ink-soft leading-snug">{cue.note}</p>
        )}
      </div>
      {asset && (
        <a
          href={`${asset.url}${asset.url.includes("?") ? "&" : "?"}download=1`}
          className="shrink-0 border-2 border-line bg-background px-1.5 py-0.5 rounded-sm nb-press text-[9px] font-black uppercase tracking-widest"
        >
          {t(lang, "download")}
        </a>
      )}
    </div>
  );
}

function ScriptBlock({
  text,
  cues,
  assets,
  lang = "en",
}: {
  text: string;
  cues?: ScriptCue[];
  assets?: FormatAsset[];
  lang?: Lang;
}) {
  const lines = parseScriptLines(text);
  if (lines.length === 0) return null;
  // Cues whose beat was rewritten or deleted still have to reach the creator,
  // so they land in a labelled group at the bottom instead of disappearing.
  const { byIndex, orphans: stranded } = resolveCues(cues, lines);
  return (
    <div className="border-2 border-line bg-paper rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
        {t(lang, "script")}
      </div>
      <ol className="space-y-2">
        {lines.map((l, i) => {
          const beatCues = byIndex.get(i) ?? [];
          return (
            <li key={i} className="flex gap-3 items-start">
              {l.timestamp ? (
                <span className="shrink-0 font-mono text-xs font-bold border-2 border-line bg-background px-1.5 py-0.5 rounded-sm">
                  {l.timestamp}
                </span>
              ) : (
                <span className="shrink-0 w-7" aria-hidden />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="block text-ink leading-relaxed">{l.body}</span>
                {beatCues.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
                      {t(lang, "onScreen")}
                    </div>
                    {beatCues.map((c) => (
                      <CueChip key={c.id} cue={c} assets={assets} lang={lang} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {stranded.length > 0 && (
        <div className="mt-4 pt-3 border-t-2 border-line space-y-1.5">
          <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
            {t(lang, "cueMissingBeat")}
          </div>
          {stranded.map((c) => (
            <CueChip key={c.id} cue={c} assets={assets} lang={lang} />
          ))}
          <p className="text-[11px] text-muted">{t(lang, "cueMissingBeatHint")}</p>
        </div>
      )}
    </div>
  );
}

// Renders a format description. If the text contains a script marker like
// "USE THIS SCRIPT:" or "SCRIPT:", the prose before the marker renders as a
// paragraph and the rest renders as a timestamped script block.
function FormatDescription({ text, lang = "en" }: { text: string; lang?: Lang }) {
  const match = text.match(
    /^([\s\S]*?)\b(use this script:?|script:)\s*([\s\S]*)$/i
  );
  if (!match) {
    return <p className="text-ink leading-relaxed max-w-3xl">{text}</p>;
  }
  const prose = match[1].trim();
  return (
    <div className="space-y-4 max-w-3xl">
      {prose && <p className="text-ink leading-relaxed">{prose}</p>}
      <ScriptBlock text={match[3]} lang={lang} />
    </div>
  );
}

function HookRow({
  hook,
  index,
  lang = "en",
}: {
  hook: Hook;
  index: number;
  lang?: Lang;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(hook.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
    <li>
      <button
        type="button"
        onClick={onCopy}
        className="group w-full text-left flex items-start gap-3 border-2 border-line bg-background px-3 py-2.5 rounded-md nb-press"
        title={t(lang, "clickToCopy")}
        aria-label={`${t(lang, "copyHook")}: ${hook.text}`}
      >
        <span className="font-mono text-[11px] font-bold text-muted pt-1 min-w-[1.75rem]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="text-sm sm:text-[15px] text-ink flex-1 leading-relaxed">
          &ldquo;{hook.text}&rdquo;
        </span>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 border-2 border-line rounded-sm ${
            copied
              ? "bg-success text-success-ink"
              : "bg-background text-ink opacity-0 group-hover:opacity-100 transition-opacity"
          }`}
        >
          {copied ? t(lang, "copied") : t(lang, "copy")}
        </span>
      </button>
      {hook.note && (
        <p className="text-xs text-muted mt-1 pl-10 pr-2">{hook.note}</p>
      )}
    </li>
  );
}

export type BriefAccountSetupPlatform = {
  name: string;
  notes?: string;
  image?: string;
};
export type BriefAccountSetup = {
  intro?: string;
  platforms?: BriefAccountSetupPlatform[];
};

export type BriefRule = {
  text: string;
  sub?: string[];
};

export type BriefOverview = {
  heroHeadline?: string;
  heroAccentWord?: string;
  heroSubtext?: string;
  productHeading?: string;
  productDescription?: string;
  valueProps?: string[];
  audience?: string[];
  tagline?: string;
  taglineSub?: string;
  howToUse?: string;
  rules?: BriefRule[];
  rulesIntro?: string;
  accountSetup?: BriefAccountSetup;
  ctaLabel?: string;
  ctaUrl?: string;
};

function renderHeroHeadline(line?: string, accent?: string) {
  if (!line) return null;
  if (!accent) return <>{line}</>;
  const idx = line.toLowerCase().indexOf(accent.toLowerCase());
  if (idx < 0) return <>{line}</>;
  const before = line.slice(0, idx);
  const match = line.slice(idx, idx + accent.length);
  const after = line.slice(idx + accent.length);
  return (
    <>
      {before}
      <span className="bg-accent text-accent-ink border-2 border-line px-2 rounded-md inline-block">
        {match}
      </span>
      {after}
    </>
  );
}

export function OverviewView({
  briefName,
  overview,
  lang = "en",
}: {
  briefName: string;
  overview: BriefOverview | null;
  lang?: Lang;
}) {
  const o: BriefOverview = overview ?? {};
  const valueProps = o.valueProps ?? [];
  const audience = o.audience ?? [];

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <SectionLabel>{briefName} {t(lang, "creatorBrief")}</SectionLabel>
        {o.heroHeadline && (
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            {renderHeroHeadline(o.heroHeadline, o.heroAccentWord)}
          </h1>
        )}
        {o.heroSubtext && (
          <p className="text-base sm:text-lg text-ink-soft max-w-2xl leading-relaxed">
            {o.heroSubtext}
          </p>
        )}
      </header>

      {o.accountSetup &&
        (o.accountSetup.intro ||
          (o.accountSetup.platforms ?? []).length > 0) && (
          <section className="border-2 border-line bg-background rounded-md nb-shadow p-5 sm:p-6 space-y-5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                {t(lang, "accountSetup")}
              </div>
              {(o.accountSetup.platforms ?? []).length > 0 && (
                <Pill>
                  {(o.accountSetup.platforms ?? []).length}{" "}
                  {(o.accountSetup.platforms ?? []).length === 1
                    ? t(lang, "platformWord")
                    : t(lang, "platformsWord")}
                </Pill>
              )}
            </div>
            {o.accountSetup.intro && (
              <p className="text-ink leading-relaxed max-w-3xl whitespace-pre-line">
                {o.accountSetup.intro}
              </p>
            )}
            {(o.accountSetup.platforms ?? []).length > 0 && (
              <div className="grid gap-5 md:grid-cols-2">
                {(o.accountSetup.platforms ?? []).map((p, i) => (
                  <div
                    key={i}
                    className="border-2 border-line bg-paper rounded-md p-4 space-y-3"
                  >
                    {p.name && (
                      <h3 className="text-lg font-black">{p.name}</h3>
                    )}
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt={p.name ? `${p.name} profile example` : ""}
                        className="block w-full h-auto border-2 border-line rounded-md bg-background"
                      />
                    )}
                    {p.notes && (
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                        {p.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      {(o.productHeading ||
        o.productDescription ||
        valueProps.length > 0 ||
        audience.length > 0 ||
        o.tagline) && (
        // Two columns only when there IS a second card. A brief with no
        // audience or tagline used to leave the product card stranded in a
        // half-width column with dead space beside it.
        <div
          className={`grid gap-6 ${
            (audience.length > 0 || o.tagline) &&
            (o.productHeading || o.productDescription || valueProps.length > 0)
              ? "md:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {(o.productHeading ||
            o.productDescription ||
            valueProps.length > 0) && (
            <section className="border-2 border-line bg-background rounded-md nb-shadow p-5 sm:p-6">
              {o.productHeading && (
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
                  {o.productHeading}
                </div>
              )}
              {o.productDescription && (
                <RichText html={o.productDescription} className="text-base" />
              )}
              {valueProps.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mt-6 mb-3">
                    {t(lang, "coreValueProps")}
                  </div>
                  <ul className="space-y-2">
                    {valueProps.map((v) => (
                      <li key={v} className="flex gap-2 text-ink">
                        <span className="text-accent font-black shrink-0">
                          ◆
                        </span>
                        <InlineRich text={v} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {(audience.length > 0 || o.tagline) && (
            <section className="border-2 border-line bg-background rounded-md nb-shadow p-5 sm:p-6">
              {audience.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
                    {t(lang, "audienceHeading")}
                  </div>
                  <ul className="space-y-2">
                    {audience.map((a) => (
                      <li key={a} className="flex gap-2 text-ink">
                        <span className="text-accent font-black shrink-0">
                          →
                        </span>
                        <InlineRich text={a} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {o.tagline && (
                <div
                  className={`${audience.length > 0 ? "mt-6" : ""} border-2 border-line bg-paper rounded-md p-4`}
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
                    {t(lang, "brandTagline")}
                  </div>
                  <p className="text-xl font-black">&ldquo;{o.tagline}&rdquo;</p>
                  {o.taglineSub && (
                    <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                      {o.taglineSub}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {o.howToUse && (
        <section className="border-2 border-line bg-accent text-accent-ink rounded-md nb-shadow p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2">
            {t(lang, "howToUseBrief")}
          </div>
          {/* This block is already accent-coloured, so a highlight has to
              invert (dark on light) or it would vanish into the background. */}
          <RichText
            html={o.howToUse}
            className="[&_mark]:bg-background [&_mark]:text-ink [&_a]:decoration-accent-ink"
          />
        </section>
      )}

      {(o.rules ?? []).length > 0 && (
        <RulesBlock
          rules={o.rules!}
          intro={o.rulesIntro}
          lang={lang}
        />
      )}
    </div>
  );
}

export function FormatView({
  format,
  hookCategories,
  useAllHooks = false,
  publicStats,
  lang = "en",
}: {
  format: Format;
  hookCategories: HookCategory[];
  useAllHooks?: boolean;
  publicStats?: { enabled: boolean; visible?: string[] };
  lang?: Lang;
}) {
  const matchingRaw = useAllHooks
    ? hookCategories
    : hookCategories.filter((c) =>
        format.hookCategorySlugs.includes(c.slug)
      );
  const matching = matchingRaw
    .map((c) => ({ ...c, hooks: c.hooks.filter((h) => !h.hidden) }))
    .filter((c) => c.hooks.length > 0);
  const totalHooks = matching.reduce((n, c) => n + c.hooks.length, 0);

  const sections: Record<FormatSectionKey, React.ReactNode> = {
    script:
      !isHidden(format, "script") && format.script ? (
        <ScriptBlock
          text={format.script}
          cues={format.scriptCues}
          assets={format.assets}
          lang={lang}
        />
      ) : null,
    caption:
      !isHidden(format, "caption") && hasCaption(format.caption) ? (
        <CaptionBlock caption={format.caption!} lang={lang} />
      ) : null,
    examples:
      !isHidden(format, "examples") && format.examples.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              {t(lang, "topExamples")}
            </div>
            <Pill tone="accent">
              {format.examples.length} {t(lang, "videosWord")}
            </Pill>
          </div>
          <VideoCarousel videos={format.examples} />
        </section>
      ) : null,
    structure:
      !isHidden(format, "structure") && visibleItems(format.structure).length > 0 ? (
        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-4">
            {t(lang, "structure")}
          </div>
          <ol className="space-y-3">
            {visibleItems(format.structure).map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                badge={
                  <span
                    className="shrink-0 w-7 h-7 border-2 border-line bg-paper flex items-center justify-center font-mono text-xs font-bold rounded-sm"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                }
              />
            ))}
          </ol>
        </section>
      ) : null,
    hooks:
      !isHidden(format, "hooks") && matching.length > 0 ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              {t(lang, "hooksFit")}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Pill tone="accent">{totalHooks} {t(lang, "hooksWord")}</Pill>
              <Pill>{t(lang, "clickToCopy")}</Pill>
            </div>
          </div>
          <div className="space-y-6">
            {matching.map((c) => (
              <div
                key={c.slug}
                className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
                  <h3 className="text-lg font-black text-ink">{c.title}</h3>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                    {c.hooks.length} {t(lang, "hooksWord")}
                  </span>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed mb-3">
                  {c.summary}
                </p>
                <div className="border-l-2 border-accent pl-3 mb-4">
                  <p className="text-sm text-ink leading-relaxed">
                    <span className="font-bold">{t(lang, "whyItWorks")}</span>
                    {c.whyItWorks}
                  </p>
                </div>
                <ul className="space-y-2">
                  {c.hooks.map((h, i) => (
                    <HookRow key={i} hook={h} index={i} lang={lang} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null,
    songs:
      !isHidden(format, "songs") && visibleSongs(format.songs).length > 0 ? (
        <SongsBlock songs={visibleSongs(format.songs)} lang={lang} />
      ) : null,
    assets:
      (format.assets?.length ?? 0) > 0 ? (
        <AssetsBlock assets={format.assets!} lang={lang} />
      ) : null,
  };

  const order = effectiveSectionOrder(format.sectionOrder);

  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <SectionLabel>{t(lang, "formatLabel")}</SectionLabel>
          <Pill>
            {format.examples.length} {t(lang, "references")}
          </Pill>
        </div>
        <div className="flex items-start gap-4">
          <Thumbnail
            src={format.thumbnail}
            slug={format.slug}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              {format.title}
            </h1>
            <p className="text-ink-soft mt-1 text-sm sm:text-base">
              {format.tagline}
            </p>
          </div>
        </div>
        <FormatDescription text={format.description} lang={lang} />
        {publicStats?.enabled && format.examples.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sanitizeVisibleStats(
              publicStats.visible ?? SECTION_STAT_DEFAULTS
            ).map((k) => (
              <div
                key={k}
                className="border-2 border-line bg-paper px-2.5 py-1.5 rounded-sm min-w-[80px]"
              >
                <div className="text-base font-black leading-none">
                  {computeSectionStat(k, format.examples)}
                </div>
                <div className="text-[9px] uppercase tracking-widest font-bold text-muted mt-1 leading-none">
                  {t(
                    lang,
                    `stat${k.charAt(0).toUpperCase()}${k.slice(1)}` as UIKey
                  ) || SECTION_STAT_LABELS[k]}
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      {order.map((key) => (
        <React.Fragment key={key}>{sections[key]}</React.Fragment>
      ))}
    </article>
  );
}

// Small copy-to-clipboard button used by the caption + hashtag blocks.
function CopyButton({
  value,
  label,
  tone = "plain",
  lang = "en",
}: {
  value: string;
  label: string;
  tone?: "plain" | "accent";
  lang?: Lang;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked — the text is on screen to select by hand */
        }
      }}
      className={`shrink-0 border-2 border-line px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest ${
        tone === "accent"
          ? "bg-accent text-accent-ink"
          : "bg-background"
      }`}
    >
      {copied ? t(lang, "copied") : label}
    </button>
  );
}

// The copy that goes in the post, not in the video: caption, alternates, tags
// and a CTA. Everything is one tap to copy because creators are on a phone.
function CaptionBlock({
  caption,
  lang = "en",
}: {
  caption: FormatCaption;
  lang?: Lang;
}) {
  const options = (caption.options ?? []).filter((o) => o.text?.trim());
  const tags = (caption.hashtags ?? [])
    .map((h) => h.trim().replace(/^#+/, ""))
    .filter(Boolean);
  const tagLine = tags.map((h) => `#${h}`).join(" ");
  const main = caption.text?.trim();
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          {t(lang, "captionHeading")}
        </div>
        {options.length > 0 && (
          <Pill tone="accent">
            {options.length}{" "}
            {options.length === 1
              ? t(lang, "captionOptionWord")
              : t(lang, "captionOptionsWord")}
          </Pill>
        )}
      </div>

      {main && (
        <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-ink leading-relaxed whitespace-pre-wrap">
              {main}
            </p>
            <CopyButton
              value={tagLine ? `${main}\n\n${tagLine}` : main}
              label={t(lang, "copyCaption")}
              tone="accent"
              lang={lang}
            />
          </div>
        </div>
      )}

      {options.length > 0 && (
        <div className="space-y-2">
          <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
            {t(lang, "captionOptions")}
          </div>
          {options.map((o, i) => (
            <div
              key={o.id || i}
              className="border-2 border-line bg-background rounded-md p-3 flex items-start gap-3"
            >
              <span
                className="shrink-0 w-6 h-6 border-2 border-line bg-paper rounded-sm flex items-center justify-center text-[10px] font-black"
                aria-hidden
              >
                {String.fromCharCode(65 + i)}
              </span>
              <div className="min-w-0 flex-1">
                {o.label?.trim() && (
                  <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted mb-0.5">
                    {o.label}
                  </div>
                )}
                <p className="text-ink leading-relaxed whitespace-pre-wrap">
                  {o.text}
                </p>
              </div>
              <CopyButton
                value={tagLine ? `${o.text}\n\n${tagLine}` : o.text}
                label={t(lang, "copy")}
                lang={lang}
              />
            </div>
          ))}
        </div>
      )}

      {caption.cta?.trim() && (
        <div className="border-2 border-line bg-paper rounded-md p-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted mb-0.5">
              {t(lang, "ctaHeading")}
            </div>
            <p className="text-ink leading-relaxed">{caption.cta}</p>
          </div>
          <CopyButton value={caption.cta} label={t(lang, "copy")} lang={lang} />
        </div>
      )}

      {tags.length > 0 && (
        <div className="border-2 border-line bg-background rounded-md p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
              {t(lang, "hashtagsHeading")}
            </div>
            <CopyButton
              value={tagLine}
              label={t(lang, "copyHashtags")}
              lang={lang}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((h, i) => (
              <span
                key={i}
                className="border-2 border-line bg-paper px-1.5 py-0.5 rounded-sm text-xs font-bold"
              >
                #{h}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted">
        {caption.note?.trim() || t(lang, "captionHint")}
      </p>
    </section>
  );
}

// Campaign rules. Given its own heavy block rather than folded into the prose
// because breaking one of these usually costs the creator the payout, so it has
// to survive a creator skimming the page.
function RulesBlock({
  rules,
  intro,
  lang = "en",
}: {
  rules: BriefRule[];
  intro?: string;
  lang?: Lang;
}) {
  const clean = rules.filter((r) => r.text?.trim());
  if (clean.length === 0) return null;
  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow p-5 sm:p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-2xl font-black tracking-tight">
          {t(lang, "rulesHeading")}
        </h2>
        <Pill tone="accent">
          {clean.length}{" "}
          {clean.length === 1 ? t(lang, "ruleWord") : t(lang, "rulesWord")}
        </Pill>
      </div>
      <p className="text-sm font-bold text-ink-soft">
        {intro?.trim() || t(lang, "rulesMustFollow")}
      </p>
      <ol className="space-y-3">
        {clean.map((r, i) => {
          const sub = (r.sub ?? []).filter((x) => x?.trim());
          return (
            <li key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 border-2 border-line bg-ink text-background rounded-sm flex items-center justify-center text-xs font-black">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink leading-relaxed font-bold">
                  <InlineRich text={r.text} />
                </p>
                {sub.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {sub.map((x, j) => (
                      <li
                        key={j}
                        className="flex gap-2 items-start text-sm text-ink-soft leading-relaxed"
                      >
                        <span className="shrink-0 mt-[7px] w-1.5 h-1.5 bg-ink/50 rounded-full" aria-hidden />
                        <InlineRich text={x} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SongsBlock({
  songs,
  lang = "en",
}: {
  songs: FormatSong[];
  lang?: Lang;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          {t(lang, "soundsToUse")}
        </div>
        <Pill tone="accent">
          {songs.length}{" "}
          {songs.length === 1 ? t(lang, "soundWord") : t(lang, "soundsWord")}
        </Pill>
      </div>
      <ul className="space-y-2">
        {songs.map((s, i) => (
          <SongRow key={i} song={s} lang={lang} />
        ))}
      </ul>
      <p className="text-[11px] text-muted">{t(lang, "soundsHint")}</p>
    </section>
  );
}

function SongRow({ song, lang = "en" }: { song: FormatSong; lang?: Lang }) {
  const [copied, setCopied] = useState(false);
  const links = songLinks(song);
  const primary = links[0] ?? song.url;
  const alts = links.slice(1);
  const platform = detectSongPlatform(primary);
  const title =
    song.title?.trim() || songTitleFromUrl(primary) || t(lang, "untitledSound");
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(primary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
    <li className="border-2 border-line bg-background rounded-md nb-shadow-sm p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 w-9 h-9 border-2 border-line bg-accent text-accent-ink rounded-sm flex items-center justify-center text-base"
          aria-hidden
        >
          ♪
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-black text-ink truncate">{title}</span>
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted shrink-0">
              {SONG_PLATFORM_LABELS[platform]}
            </span>
          </div>
          {song.artist && (
            <div className="text-xs text-ink-soft truncate">{song.artist}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCopy}
            className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {copied ? t(lang, "copied") : t(lang, "copyLink")}
          </button>
          <a
            href={primary}
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-line bg-accent text-accent-ink px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {t(lang, "openSound")} ↗
          </a>
        </div>
      </div>

      {/* The same sound on other platforms. An Instagram creator cannot open a
          TikTok sound link, so each platform gets its own button. */}
      {(alts.length > 0 || song.fileUrl) && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2 pl-12">
          {alts.length > 0 && (
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
              {t(lang, "alsoOnWord")}
            </span>
          )}
          {alts.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-line bg-paper px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              {SONG_PLATFORM_LABELS[detectSongPlatform(u)]} ↗
            </a>
          ))}
          {song.fileUrl && (
            <a
              href={`${song.fileUrl}${song.fileUrl.includes("?") ? "&" : "?"}download=1`}
              className="border-2 border-line bg-background px-2 py-0.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              ⬇ {t(lang, "downloadAudio")}
            </a>
          )}
        </div>
      )}

      {song.fileUrl && (
        <audio
          src={song.fileUrl}
          controls
          preload="none"
          className="w-full mt-2"
        />
      )}

      {song.note && (
        <p className="text-sm text-ink-soft leading-relaxed mt-2 pl-12">
          {song.note}
        </p>
      )}
    </li>
  );
}

function AssetsBlock({
  assets,
  lang = "en",
}: {
  assets: FormatAsset[];
  lang?: Lang;
}) {
  const overlay = assets.find((a) => a.kind === "overlay");
  const verses = assets.filter((a) => a.kind === "verse");
  const rest = assets.filter((a) => a !== overlay && a.kind !== "verse");
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          {t(lang, "assetsToUse")}
        </div>
        <Pill tone="accent">
          {assets.length}{" "}
          {assets.length === 1 ? t(lang, "fileWord") : t(lang, "filesWord")}
        </Pill>
      </div>

      {overlay && (
        <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
            <h3 className="text-base font-black text-ink">
              ▶ {t(lang, "overlayExample")}
            </h3>
            <a
              href={`${overlay.url}${overlay.url.includes("?") ? "&" : "?"}download=1`}
              className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              {t(lang, "download")}
            </a>
          </div>
          {overlay.label && (
            <p className="text-sm text-ink-soft leading-relaxed mb-3">
              {overlay.label}
            </p>
          )}
          <video
            src={overlay.url}
            controls
            playsInline
            preload="metadata"
            className="w-full max-w-md mx-auto border-2 border-line rounded-sm bg-black"
          />
        </div>
      )}

      {verses.map((a, i) => (
        <VerseCard key={`v${i}`} asset={a} lang={lang} />
      ))}

      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rest.map((a, i) => (
            <AssetCard key={i} asset={a} lang={lang} />
          ))}
        </div>
      )}
    </section>
  );
}

function VerseCard({ asset, lang = "en" }: { asset: FormatAsset; lang?: Lang }) {
  const [bg, setBg] = useState(VERSE_BACKGROUNDS[0].key);
  const base =
    `/api/verse-card?ref=${encodeURIComponent(asset.verseRef ?? "")}` +
    `&text=${encodeURIComponent(asset.verseText ?? "")}` +
    `&version=${encodeURIComponent(asset.verseVersion ?? "")}`;
  const previewUrl = `${base}&style=${bg}`;
  return (
    <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="text-base font-black text-ink">
          📖 {asset.verseRef || t(lang, "bibleVerse")}
        </h3>
        <a
          href={`${previewUrl}&download=1`}
          className="border-2 border-line bg-accent text-accent-ink px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          {t(lang, "download")}
        </a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={asset.verseRef ?? "verse"}
        className="w-full max-w-md mx-auto border-2 border-line rounded-md bg-paper"
      />
      <div className="flex items-center gap-2 justify-center flex-wrap">
        <select
          value={bg}
          onChange={(e) => setBg(e.target.value)}
          className="border-2 border-line bg-background px-3 py-1.5 rounded-sm text-xs font-bold nb-press"
        >
          {VERSE_BACKGROUNDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setBg(randomBackgroundKey())}
          className="border-2 border-line bg-background px-3 py-1.5 rounded-sm nb-press text-xs font-black uppercase tracking-widest"
        >
          🎲 {t(lang, "random")}
        </button>
      </div>
      <p className="text-[11px] text-muted text-center">
        {t(lang, "pickBackground")}
      </p>
    </div>
  );
}

function AssetCard({ asset, lang = "en" }: { asset: FormatAsset; lang?: Lang }) {
  const isImage = asset.mime.startsWith("image/");
  const isVideo = asset.mime.startsWith("video/");
  const name = asset.label || asset.filename || "Asset";
  return (
    <div className="border-2 border-line bg-background rounded-md nb-shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-video bg-paper border-b-2 border-line flex items-center justify-center overflow-hidden">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.url} alt={name} className="w-full h-full object-cover" />
        ) : isVideo ? (
          <video
            src={asset.url}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <span className="text-xs font-black uppercase tracking-widest text-muted">
            {asset.mime}
          </span>
        )}
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{name}</div>
          {asset.filename && asset.label && (
            <div className="text-[10px] font-mono text-muted truncate">
              {asset.filename}
            </div>
          )}
        </div>
        <a
          href={`${asset.url}${asset.url.includes("?") ? "&" : "?"}download=1`}
          className="shrink-0 border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          {t(lang, "download")}
        </a>
      </div>
    </div>
  );
}

