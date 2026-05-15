import "server-only";
import { allVideos } from "./all-videos";
import type { Format, FormatSectionKey, VideoExample } from "./types";
import { formats as formatsMeta } from "./formats";
import { getCuration, type CurationData } from "./db";

// Formats show ONLY manually-pinned videos. No bucket auto-fill.

export type FormatListing = {
  slug: string;
  videos: VideoExample[];
  topThumb?: string;
};

function buildListing(
  formatSlug: string,
  curation: CurationData
): FormatListing {
  const excluded = new Set(curation.exclude);
  const pins = curation.formatPins[formatSlug] ?? [];
  const videos: VideoExample[] = [];
  const seen = new Set<string>();
  for (const pinId of pins) {
    if (excluded.has(pinId) || seen.has(pinId)) continue;
    // Static Rork Research pool first, then per-brief cached metadata (for
    // videos pinned from other ViewTrack projects).
    const v: VideoExample | undefined =
      allVideos.find((x) => x.dbId === pinId) ??
      (curation.videoMetadata?.[pinId] as VideoExample | undefined);
    if (v) {
      videos.push(v);
      seen.add(pinId);
    }
  }
  return {
    slug: formatSlug,
    videos,
    topThumb: videos[0]?.thumbnail,
  };
}

export async function getFormatListing(
  formatSlug: string,
  briefSlug?: string
): Promise<FormatListing> {
  const curation = await getCuration(briefSlug);
  return buildListing(formatSlug, curation);
}

// Resolve a slug (which may be a clone) to its static base meta. Returns
// undefined if the slug doesn't map to any known format.
function resolveBaseMeta(slug: string, curation: CurationData) {
  const direct = formatsMeta.find((f) => f.slug === slug);
  if (direct) return direct;
  const cloneSource = curation.formatClones?.[slug];
  if (!cloneSource) return undefined;
  return formatsMeta.find((f) => f.slug === cloneSource);
}

export async function getAllFormatListings(
  briefSlug?: string
): Promise<Record<string, FormatListing>> {
  const curation = await getCuration(briefSlug);
  const out: Record<string, FormatListing> = {};
  for (const meta of formatsMeta) {
    out[meta.slug] = buildListing(meta.slug, curation);
  }
  // Clone slugs use their own pins, not the source's.
  for (const cloneSlug of Object.keys(curation.formatClones ?? {})) {
    out[cloneSlug] = buildListing(cloneSlug, curation);
  }
  return out;
}

// Merge static metadata with freshly-read pins + admin-set overrides,
// filtered + ordered by the per-brief formatOrder. Cloned format slugs
// inherit their base meta (structure/tips/etc.) from the source format.
export async function getFormatsForRender(briefSlug?: string): Promise<Format[]> {
  const curation = await getCuration(briefSlug);
  const listings = await getAllFormatListings(briefSlug);
  const order =
    curation.formatOrder && curation.formatOrder.length > 0
      ? curation.formatOrder
      : [
          ...formatsMeta.map((f) => f.slug),
          ...Object.keys(curation.formatClones ?? {}),
        ];
  const out: Format[] = [];
  for (const slug of order) {
    const meta = resolveBaseMeta(slug, curation);
    if (!meta) continue;
    const ov = curation.formatOverrides?.[slug] ?? {};
    out.push({
      ...meta,
      slug,
      title: ov.title?.trim() || meta.title,
      tagline: ov.tagline?.trim() || meta.tagline,
      description: ov.description?.trim() || meta.description,
      script: ov.script?.trim() || undefined,
      structure: ov.structure && ov.structure.length > 0 ? ov.structure : meta.structure,
      tips: ov.tips && ov.tips.length > 0 ? ov.tips : meta.tips,
      bestFor: ov.bestFor && ov.bestFor.length > 0 ? ov.bestFor : meta.bestFor,
      thumbnail: listings[slug]?.topThumb ?? meta.thumbnail,
      examples: listings[slug]?.videos ?? [],
      hiddenSections: (ov.hiddenSections ?? []) as FormatSectionKey[],
    });
  }
  return out;
}

export async function getAdminPreview(
  briefSlug?: string
): Promise<
  Record<
    string,
    { pinnedVideos: VideoExample[]; autoVideos: VideoExample[] }
  >
> {
  const curation = await getCuration(briefSlug);
  const out: Record<
    string,
    { pinnedVideos: VideoExample[]; autoVideos: VideoExample[] }
  > = {};
  for (const meta of formatsMeta) {
    const listing = buildListing(meta.slug, curation);
    out[meta.slug] = {
      pinnedVideos: listing.videos,
      autoVideos: [],
    };
  }
  // Cloned sections live alongside base formats — their pins are stored
  // under their own slug, so build a listing for each.
  for (const cloneSlug of Object.keys(curation.formatClones ?? {})) {
    const listing = buildListing(cloneSlug, curation);
    out[cloneSlug] = {
      pinnedVideos: listing.videos,
      autoVideos: [],
    };
  }
  return out;
}
