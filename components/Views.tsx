"use client";

import React, { useState } from "react";
import type {
  Format,
  FormatAsset,
  FormatListItem,
  FormatSectionKey,
  Hook,
  HookCategory,
  ListItem,
} from "@/lib/types";
import { DEFAULT_SECTION_ORDER } from "@/lib/types";

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

type ScriptLine = { timestamp?: string; body: string };

function parseScriptLines(text: string): ScriptLine[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const byLine = trimmed
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byLine.length > 1) {
    return byLine.map((line) => {
      const m = line.match(/^(\d{1,2}:\d{2})\s*[:\-–]?\s*(.*)$/);
      return m ? { timestamp: m[1], body: m[2] } : { body: line };
    });
  }
  const re = /(\d{1,2}:\d{2})\s+/g;
  const parts: ScriptLine[] = [];
  let lastIndex = 0;
  let lastTs: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    const segment = trimmed.slice(lastIndex, m.index).trim();
    if (segment) parts.push({ timestamp: lastTs, body: segment });
    lastTs = m[1];
    lastIndex = m.index + m[0].length;
  }
  const tail = trimmed.slice(lastIndex).trim();
  if (tail) parts.push({ timestamp: lastTs, body: tail });
  return parts.length ? parts : [{ body: trimmed }];
}

function ScriptBlock({ text }: { text: string }) {
  const lines = parseScriptLines(text);
  if (lines.length === 0) return null;
  return (
    <div className="border-2 border-line bg-paper rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-3">
        Script
      </div>
      <ol className="space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-3 items-start">
            {l.timestamp ? (
              <span className="shrink-0 font-mono text-xs font-bold border-2 border-line bg-background px-1.5 py-0.5 rounded-sm">
                {l.timestamp}
              </span>
            ) : (
              <span className="shrink-0 w-7" aria-hidden />
            )}
            <span className="text-ink leading-relaxed">{l.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Renders a format description. If the text contains a script marker like
// "USE THIS SCRIPT:" or "SCRIPT:", the prose before the marker renders as a
// paragraph and the rest renders as a timestamped script block.
function FormatDescription({ text }: { text: string }) {
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
      <ScriptBlock text={match[3]} />
    </div>
  );
}

function HookRow({ hook, index }: { hook: Hook; index: number }) {
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
        title="Click to copy"
        aria-label={`Copy hook: ${hook.text}`}
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
          {copied ? "Copied" : "Copy"}
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
}: {
  briefName: string;
  overview: BriefOverview | null;
}) {
  const o: BriefOverview = overview ?? {};
  const valueProps = o.valueProps ?? [];
  const audience = o.audience ?? [];

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <SectionLabel>{briefName} Creator Brief</SectionLabel>
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
                Account setup
              </div>
              {(o.accountSetup.platforms ?? []).length > 0 && (
                <Pill>
                  {(o.accountSetup.platforms ?? []).length}{" "}
                  {(o.accountSetup.platforms ?? []).length === 1
                    ? "platform"
                    : "platforms"}
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
        <div className="grid gap-6 md:grid-cols-2">
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
                <p className="text-ink leading-relaxed whitespace-pre-line">
                  {o.productDescription}
                </p>
              )}
              {valueProps.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mt-6 mb-3">
                    Core value props
                  </div>
                  <ul className="space-y-2">
                    {valueProps.map((v) => (
                      <li key={v} className="flex gap-2 text-ink">
                        <span className="text-accent font-black shrink-0">
                          ◆
                        </span>
                        <span>{v}</span>
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
                    Who you&rsquo;re talking to
                  </div>
                  <ul className="space-y-2">
                    {audience.map((a) => (
                      <li key={a} className="flex gap-2 text-ink">
                        <span className="text-accent font-black shrink-0">
                          →
                        </span>
                        <span>{a}</span>
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
                    Brand tagline
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
            How to use this brief
          </div>
          <p className="leading-relaxed whitespace-pre-line">{o.howToUse}</p>
        </section>
      )}
    </div>
  );
}

export function FormatView({
  format,
  hookCategories,
  useAllHooks = false,
  publicStats,
}: {
  format: Format;
  hookCategories: HookCategory[];
  useAllHooks?: boolean;
  publicStats?: { enabled: boolean; visible?: string[] };
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
        <ScriptBlock text={format.script} />
      ) : null,
    examples:
      !isHidden(format, "examples") && format.examples.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Top-performing examples
            </div>
            <Pill tone="accent">{format.examples.length} videos</Pill>
          </div>
          <VideoCarousel videos={format.examples} />
        </section>
      ) : null,
    bestFor:
      !isHidden(format, "bestFor") && visibleItems(format.bestFor).length > 0 ? (
        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-4">
            Best for
          </div>
          <ul className="space-y-3">
            {visibleItems(format.bestFor).map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                badge={
                  <span
                    className="shrink-0 w-7 h-7 border-2 border-line bg-paper flex items-center justify-center font-black rounded-sm"
                    aria-hidden
                  >
                    ★
                  </span>
                }
              />
            ))}
          </ul>
        </section>
      ) : null,
    structure:
      !isHidden(format, "structure") && visibleItems(format.structure).length > 0 ? (
        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-4">
            Shot-by-shot structure
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
    tips:
      !isHidden(format, "tips") && visibleItems(format.tips).length > 0 ? (
        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-4">
            Tips
          </div>
          <ul className="space-y-3">
            {visibleItems(format.tips).map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                badge={
                  <span
                    className="shrink-0 w-7 h-7 border-2 border-line bg-paper flex items-center justify-center font-black rounded-sm"
                    aria-hidden
                  >
                    ✓
                  </span>
                }
              />
            ))}
          </ul>
        </section>
      ) : null,
    hooks:
      !isHidden(format, "hooks") && matching.length > 0 ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Hooks that fit this format
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Pill tone="accent">{totalHooks} hooks</Pill>
              <Pill>Click any to copy</Pill>
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
                    {c.hooks.length} hooks
                  </span>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed mb-3">
                  {c.summary}
                </p>
                <div className="border-l-2 border-accent pl-3 mb-4">
                  <p className="text-sm text-ink leading-relaxed">
                    <span className="font-bold">Why it works for Rork: </span>
                    {c.whyItWorks}
                  </p>
                </div>
                <ul className="space-y-2">
                  {c.hooks.map((h, i) => (
                    <HookRow key={i} hook={h} index={i} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null,
    assets:
      (format.assets?.length ?? 0) > 0 ? (
        <AssetsBlock assets={format.assets!} />
      ) : null,
  };

  const order = effectiveSectionOrder(format.sectionOrder);

  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <SectionLabel>Format</SectionLabel>
          <Pill>{format.examples.length} references</Pill>
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
        <FormatDescription text={format.description} />
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
                  {SECTION_STAT_LABELS[k]}
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

function AssetsBlock({ assets }: { assets: FormatAsset[] }) {
  const overlay = assets.find((a) => a.kind === "overlay");
  const rest = assets.filter((a) => a !== overlay);
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Assets to use
        </div>
        <Pill tone="accent">{assets.length} {assets.length === 1 ? "file" : "files"}</Pill>
      </div>

      {overlay && (
        <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
            <h3 className="text-base font-black text-ink">
              ▶ Overlay example
            </h3>
            <a
              href={`${overlay.url}?download=1`}
              className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              Download
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

      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rest.map((a, i) => (
            <AssetCard key={i} asset={a} />
          ))}
        </div>
      )}
    </section>
  );
}

function AssetCard({ asset }: { asset: FormatAsset }) {
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
          href={`${asset.url}?download=1`}
          className="shrink-0 border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          Download
        </a>
      </div>
    </div>
  );
}

