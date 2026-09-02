// Server-side machine translation of brief CONTENT (overview copy, structure
// steps, hook explanations, calendar notes, onboarding steps) into the
// visitor's language. Scripts and hook lines — the words creators actually say
// on camera — are intentionally left in the language they were written in.
//
// Flow: collect every translatable string → look up sha1-keyed cache in the
// translation_cache table → translate only the misses with one Claude call →
// save the merged cache → return deep copies with translations applied. If the
// API key is missing or the call fails, untranslated strings fall back to the
// original English.

import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import {
  getTranslationCache,
  setTranslationCache,
  type BriefOverview,
  type ContentCalendar,
  type Onboarding,
  type OnboardingBlock,
} from "./db";
import type { Format, FormatListItem, HookCategory } from "./types";
import type { Lang } from "./i18n";

const LANG_NAMES: Record<string, string> = { es: "Latin American Spanish" };

// Same marker Views.tsx uses to split a description into prose + script block.
const SCRIPT_SPLIT = /^([\s\S]*?)\b(use this script:?|script:)\s*([\s\S]*)$/i;

const keyOf = (s: string) =>
  crypto.createHash("sha1").update(s).digest("hex").slice(0, 24);

// tr(s) either records s as needing translation (collect pass) or returns its
// translation (apply pass). Both passes share the localizer walkers below so
// the two can never drift apart.
type Tr = (s: string | undefined | null) => string | undefined;

function localizeItems(tr: Tr, items: FormatListItem[]): FormatListItem[] {
  return items.map((it) =>
    typeof it === "string"
      ? (tr(it) ?? it)
      : { ...it, text: tr(it.text) ?? it.text }
  );
}

function localizeDescription(tr: Tr, text: string): string {
  const m = text.match(SCRIPT_SPLIT);
  if (!m) return tr(text) ?? text;
  const prose = m[1].trim();
  const translated = prose ? (tr(prose) ?? prose) : "";
  return `${translated ? `${translated}\n\n` : ""}${m[2]} ${m[3]}`;
}

function localizeFormat(tr: Tr, f: Format): Format {
  return {
    ...f,
    title: tr(f.title) ?? f.title,
    tagline: tr(f.tagline) ?? f.tagline,
    description: localizeDescription(tr, f.description),
    // f.script stays untouched on purpose.
    bestFor: localizeItems(tr, f.bestFor),
    structure: localizeItems(tr, f.structure),
    tips: localizeItems(tr, f.tips),
    assets: f.assets?.map((a) => ({ ...a, label: tr(a.label) ?? a.label })),
    // Song titles/artists are proper names; only the guidance note translates.
    songs: f.songs?.map((s) => ({ ...s, note: tr(s.note) ?? s.note })),
    // Shot cues are directions to the creator, so both the label and the note
    // translate. The cue's asset is a file, not text.
    scriptCues: f.scriptCues?.map((c) => ({
      ...c,
      label: tr(c.label) ?? c.label,
      note: tr(c.note) ?? c.note,
    })),
    // The caption is copy the creator posts verbatim, so like f.script it stays
    // in the language it was written in. Only the guidance note translates.
    caption: f.caption
      ? { ...f.caption, note: tr(f.caption.note) ?? f.caption.note }
      : undefined,
  };
}

function localizeHookCategories(
  tr: Tr,
  cats: HookCategory[]
): HookCategory[] {
  return cats.map((c) => ({
    ...c,
    title: tr(c.title) ?? c.title,
    summary: tr(c.summary) ?? c.summary,
    whyItWorks: tr(c.whyItWorks) ?? c.whyItWorks,
    // hook.text is a spoken line — keep it; only the note is guidance.
    hooks: c.hooks.map((h) => ({ ...h, note: tr(h.note) ?? h.note })),
  }));
}

function localizeOverview(tr: Tr, o: BriefOverview): BriefOverview {
  return {
    ...o,
    heroHeadline: tr(o.heroHeadline) ?? o.heroHeadline,
    heroAccentWord: tr(o.heroAccentWord) ?? o.heroAccentWord,
    heroSubtext: tr(o.heroSubtext) ?? o.heroSubtext,
    productHeading: tr(o.productHeading) ?? o.productHeading,
    productDescription: tr(o.productDescription) ?? o.productDescription,
    valueProps: o.valueProps?.map((v) => tr(v) ?? v),
    audience: o.audience?.map((a) => tr(a) ?? a),
    tagline: tr(o.tagline) ?? o.tagline,
    taglineSub: tr(o.taglineSub) ?? o.taglineSub,
    howToUse: tr(o.howToUse) ?? o.howToUse,
    // Rules are instructions to the creator, so they translate in full. The
    // hashtag inside one is a literal and comes back untouched by the
    // translator's own "keep handles/tags verbatim" instruction.
    rulesIntro: tr(o.rulesIntro) ?? o.rulesIntro,
    rules: o.rules?.map((r) => ({
      text: tr(r.text) ?? r.text,
      sub: r.sub?.map((x) => tr(x) ?? x),
    })),
    ctaLabel: tr(o.ctaLabel) ?? o.ctaLabel,
    accountSetup: o.accountSetup
      ? {
          intro: tr(o.accountSetup.intro) ?? o.accountSetup.intro,
          platforms: o.accountSetup.platforms?.map((p) => ({
            ...p,
            notes: tr(p.notes) ?? p.notes,
          })),
        }
      : undefined,
  };
}

function localizeCalendar(tr: Tr, cal: ContentCalendar): ContentCalendar {
  return {
    ...cal,
    title: tr(cal.title) ?? cal.title,
    intro: tr(cal.intro) ?? cal.intro,
    days: cal.days.map((d) => ({
      ...d,
      assignments: d.assignments.map((a) => ({
        ...a,
        title: tr(a.title) ?? a.title,
        note: tr(a.note) ?? a.note,
        // a.script stays untouched on purpose.
      })),
    })),
  };
}

function localizeBlock(tr: Tr, b: OnboardingBlock): OnboardingBlock {
  switch (b.kind) {
    case "text":
      return { ...b, text: tr(b.text) ?? b.text };
    case "image":
    case "video":
      return { ...b, caption: tr(b.caption) ?? b.caption };
    case "videos":
      return { ...b, heading: tr(b.heading) ?? b.heading };
    case "question":
      return {
        ...b,
        label: tr(b.label) ?? b.label,
        placeholder: tr(b.placeholder) ?? b.placeholder,
        options: b.options?.map((o) => tr(o) ?? o),
      };
    // App Store reviews are real quotes — leave them as-is.
    case "reviews":
      return b;
  }
}

function localizeOnboarding(tr: Tr, ob: Onboarding): Onboarding {
  return {
    ...ob,
    steps: ob.steps.map((s) => ({
      ...s,
      title: tr(s.title) ?? s.title,
      subtitle: tr(s.subtitle) ?? s.subtitle,
      blocks: s.blocks.map((b) => localizeBlock(tr, b)),
    })),
    gate: ob.gate
      ? {
          ...ob.gate,
          heading: tr(ob.gate.heading) ?? ob.gate.heading,
          body: tr(ob.gate.body) ?? ob.gate.body,
          ctaLabel: tr(ob.gate.ctaLabel) ?? ob.gate.ctaLabel,
        }
      : undefined,
  };
}

export type BriefContent = {
  overview?: BriefOverview | null;
  hookCategories?: HookCategory[] | null;
  formats?: Format[] | null;
  contentCalendar?: ContentCalendar | null;
  onboarding?: Onboarding | null;
};

function walk(tr: Tr, data: BriefContent): BriefContent {
  return {
    overview: data.overview ? localizeOverview(tr, data.overview) : data.overview,
    hookCategories: data.hookCategories
      ? localizeHookCategories(tr, data.hookCategories)
      : data.hookCategories,
    formats: data.formats
      ? data.formats.map((f) => localizeFormat(tr, f))
      : data.formats,
    contentCalendar: data.contentCalendar
      ? localizeCalendar(tr, data.contentCalendar)
      : data.contentCalendar,
    onboarding: data.onboarding
      ? localizeOnboarding(tr, data.onboarding)
      : data.onboarding,
  };
}

// Batch by rough size so one huge brief doesn't blow a single completion.
function batchStrings(items: string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const s of items) {
    if (cur.length > 0 && (chars + s.length > 12_000 || cur.length >= 40)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(s);
    chars += s.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

// House style: no em dashes in anything user-facing.
const sanitize = (s: string) => s.replace(/\s*—\s*/g, ", ").replace(/—/g, "-");

async function translateBatch(
  client: Anthropic,
  langName: string,
  batch: string[]
): Promise<string[]> {
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `Translate each string in the JSON array below from English to natural, conversational ${langName} as used in short-form video / UGC creator marketing.

Rules:
- Keep brand names, product names, app names, handles, URLs, and emoji exactly as they are.
- Marketing headlines, slogans, and taglines MUST be translated too; adapt any wordplay naturally instead of keeping the English line.
- "hook", "brief" and "overlay" are industry terms; keep them in English.
- Preserve line breaks and any HTML tags/attributes exactly; translate only the human-readable text.
- Preserve inline markers exactly: ==highlighted text== and **bold text** keep their == and ** wrappers, with only the words between them translated.
- Never use em dashes.
- Return ONLY a JSON array of strings, same length and order as the input. No commentary, no code fences.

${JSON.stringify(batch)}`,
      },
    ],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(text) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.length !== batch.length ||
    parsed.some((s) => typeof s !== "string")
  ) {
    throw new Error("translator returned a malformed array");
  }
  return (parsed as string[]).map(sanitize);
}

// One in-flight translation run per brief+lang so parallel page loads don't
// duplicate API calls.
const inFlight = new Map<string, Promise<Record<string, string>>>();

async function resolveMap(
  briefSlug: string,
  lang: Lang,
  needed: Map<string, string> // key → source
): Promise<Record<string, string>> {
  const cache = await getTranslationCache(briefSlug, lang);
  const misses = [...needed.entries()].filter(([k]) => !(k in cache));
  if (misses.length === 0) return cache;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return cache; // no key → English fallback for the misses

  const flightKey = `${briefSlug}:${lang}`;
  const existing = inFlight.get(flightKey);
  if (existing) return existing;

  const run = (async () => {
    const client = new Anthropic({ apiKey });
    const fresh: Record<string, string> = {};
    for (const batch of batchStrings(misses.map(([, src]) => src))) {
      const translated = await translateBatch(
        client,
        LANG_NAMES[lang] ?? lang,
        batch
      );
      batch.forEach((src, i) => {
        fresh[keyOf(src)] = translated[i];
      });
    }
    const merged = { ...cache, ...fresh };
    await setTranslationCache(briefSlug, lang, merged);
    return merged;
  })().finally(() => {
    inFlight.delete(flightKey);
  });
  inFlight.set(flightKey, run);
  return run;
}

export async function localizeBriefContent(
  lang: Lang,
  briefSlug: string,
  data: BriefContent
): Promise<BriefContent> {
  if (lang === "en") return data;

  // Pass 1: collect every translatable string.
  const needed = new Map<string, string>();
  walk((s) => {
    if (s && s.trim()) needed.set(keyOf(s), s);
    return s ?? undefined;
  }, data);
  if (needed.size === 0) return data;

  let map: Record<string, string> = {};
  try {
    map = await resolveMap(briefSlug, lang, needed);
  } catch (e) {
    console.error("[translate] falling back to English:", e);
    try {
      map = await getTranslationCache(briefSlug, lang);
    } catch {
      map = {};
    }
  }

  // Pass 2: apply, falling back to the source string on any miss.
  return walk((s) => (s ? (map[keyOf(s)] ?? s) : undefined), data);
}
