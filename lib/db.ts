import "server-only";
import postgres from "postgres";
import { formats as formatsMeta } from "./formats";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalThis.__sql) {
    globalThis.__sql = postgres(process.env.DATABASE_URL, {
      ssl: process.env.DATABASE_URL.includes(".proxy.rlwy.net")
        ? "require"
        : false,
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalThis.__sql;
}

export type FormatOverrideItem = { text: string; image?: string; hidden?: boolean };
export type FormatOverrideAsset = {
  url: string;
  mime: string;
  filename?: string;
  label?: string;
  kind?: "overlay" | "asset";
};
export type FormatOverride = {
  title?: string;
  tagline?: string;
  description?: string;
  script?: string;
  structure?: FormatOverrideItem[];
  tips?: FormatOverrideItem[];
  bestFor?: FormatOverrideItem[];
  // Section keys hidden on the public page (e.g. "tips", "examples").
  hiddenSections?: string[];
  // Custom rendering order for public-page sections. Each entry is a
  // section key (script | examples | bestFor | structure | tips | hooks |
  // assets). When unset, lib/types.ts DEFAULT_SECTION_ORDER applies.
  sectionOrder?: string[];
  // Per-format downloadable assets (videos, images, etc.) shown on the
  // public brief page.
  assets?: FormatOverrideAsset[];
};

export type CurationData = {
  exclude: string[];
  formatPins: Record<string, string[]>;
  formatBuckets: Record<string, string | null>;
  formatOverrides?: Record<string, FormatOverride>;
  formatOrder?: string[];
  // ViewTrack project IDs this brief draws videos from. Empty/omitted = the
  // built-in Rork Research pool (lib/all-videos.ts).
  scopedProjectIds?: string[];
  // Metadata cache for videos pinned from projects outside the static pool.
  // Keyed by dbId (e.g. "instagram_instagram_user_ABC").
  videoMetadata?: Record<string, CachedVideo>;
  // Clones map: { "<new-slug>": "<source-slug-from-formatsMeta>" }. A clone
  // is a per-brief duplicate of a base format. It has its own pins/overrides
  // but inherits structure/tips/etc. from the source's static meta.
  formatClones?: Record<string, string>;
  // Public preview stats config. When enabled, the public /b/[slug] pages
  // render an aggregate stats bar at the top of each format section.
  publicStats?: {
    enabled: boolean;
    // Stat keys (mirrors SECTION_STAT_KEYS in BriefEditor). Free-form so the
    // db type stays decoupled from the UI enum.
    visible?: string[];
  };
  // When true the public /b/[slug] root page redirects to the first format
  // and the sidebar's "Overview" entry is dropped. Use when a brief doesn't
  // have a meaningful overview to show.
  hideOverview?: boolean;
  // Format slugs hidden from the public brief. Hidden formats remain in the
  // admin editor (grayed out) so they can still be edited offline. Separate
  // from `formatOrder`, which now controls ordering only.
  hiddenFormats?: string[];
  // Per-day shooting schedule (rubric) shown to creators so they can see what
  // to record on each date and batch-record ahead. Rendered at
  // /b/{slug}/calendar when enabled.
  contentCalendar?: ContentCalendar;
};

// A single script/task assigned to a calendar day. It either links to one of
// the brief's formats (formatSlug → the creator taps through to that format's
// full script/structure) or carries a custom one-off script typed inline.
// `note` is a per-day instruction layered on top (e.g. which hook to use).
export type CalendarAssignment = {
  id: string;
  formatSlug?: string;
  title?: string;
  script?: string;
  note?: string;
  // Short tag shown as a chip (e.g. "B1", "B2"). Set when an assignment comes
  // from a group's ordered item.
  label?: string;
};

export type CalendarDay = {
  // ISO date, "YYYY-MM-DD".
  date: string;
  assignments: CalendarAssignment[];
};

// One ordered item inside a group (e.g. the "B1" batch). Mirrors an
// assignment so it can be stamped onto a day directly.
export type CalendarGroupItem = {
  id: string;
  label?: string;
  formatSlug?: string;
  title?: string;
  script?: string;
  note?: string;
};

// A reusable category bundling an ordered series of items (B1, B2, B3…).
// Auto-fill cycles a group's items one per day across a date range.
export type CalendarGroup = {
  id: string;
  name: string;
  items: CalendarGroupItem[];
};

export type ContentCalendar = {
  // When true (and at least one day exists) the calendar shows on the public
  // brief and in the sidebar nav.
  enabled?: boolean;
  title?: string;
  intro?: string;
  days: CalendarDay[];
  // Reusable groups used by the auto-fill scheduler.
  groups?: CalendarGroup[];
};

export type CachedVideo = {
  platform: "instagram" | "tiktok" | "x" | "youtube";
  url: string;
  id: string;
  dbId: string;
  thumbnail: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  uploadDate?: string;
  creator: string;
  creatorUrl?: string;
};

const DEFAULT_CURATION: CurationData = {
  exclude: [],
  formatPins: {
    "snapchat-hook-reaction": [],
    "visual-hook-plus-device": [],
    "top-three-websites": [],
  },
  formatBuckets: {
    "talking-head": "comment-for-link",
    "snapchat-hook-reaction": "snapchat-hook-reaction",
    "reaction-plus-demo": "free-resource-drop",
    "split-screen": null,
    "building-page": "ai-tool-reveal",
    "top-three-websites": "websites-list",
    "visual-hook-plus-device": "secret-website",
  },
};

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
  // Optional CTA shown at the bottom of the sidebar. Hidden when either is empty.
  ctaLabel?: string;
  ctaUrl?: string;
};

export type BriefHook = { text: string; note?: string; hidden?: boolean };
export type BriefHookCategory = {
  slug: string;
  title: string;
  summary?: string;
  whyItWorks?: string;
  hooks: BriefHook[];
};

export type Brief = {
  slug: string;
  name: string;
  logoUrl: string | null;
  overview: BriefOverview | null;
  hookCategories: BriefHookCategory[] | null;
  createdAt: Date;
  updatedAt: Date;
};

export const DEFAULT_BRIEF_SLUG = "rork";

const RORK_OVERVIEW: BriefOverview = {
  heroHeadline: "Ship content that ships apps.",
  heroAccentWord: "apps",
  heroSubtext:
    "Formats, hooks, and reference examples for Rork creators. Pick a format on the left. Copy a hook. Ship the video. Everything is tuned for the non-technical founder audience.",
  productHeading: "What Rork is",
  productDescription:
    "Rork creates any mobile app or game for iOS & Android in minutes, just by chatting with AI. Rork Max is the first website that can build complex apps & games for iPhone. Even Pokémon Go.",
  valueProps: [
    "Idea to App Store in minutes, not months",
    "Create real mobile apps with words",
    "Start a business. Start making money on the App Store.",
    "Be the next one.",
  ],
  audience: [
    "High school & university students who want to live life on their own terms",
    "Startup founders",
    "Non-technical entrepreneurs who want to solve their own problem or quit their day job",
    "Marketers and AI early adopters",
    "Designers and PMs",
  ],
  tagline: "Be the next one.",
  taglineSub:
    "The next Mark Zuckerberg. The next Zack Yadegari. Frame the viewer as the protagonist of their own founder story.",
  howToUse:
    "Pick a format from the sidebar. Read the shot-by-shot structure. Steal a hook from the matching library. Ship the video. Repeat.",
};

let schemaPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = runSchema().catch((e) => {
    // Don't permanently cache a failure — let the next request retry.
    schemaPromise = null;
    throw e;
  });
  return schemaPromise;
}

async function runSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS brief (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      overview JSONB,
      hook_categories JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Additive migrations for older rows.
  await sql`ALTER TABLE brief ADD COLUMN IF NOT EXISTS overview JSONB`;
  await sql`ALTER TABLE brief ADD COLUMN IF NOT EXISTS hook_categories JSONB`;
  await sql`
    CREATE TABLE IF NOT EXISTS curation (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS form_template (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      brief_slug TEXT,
      fields JSONB NOT NULL DEFAULT '[]'::jsonb,
      submit_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS form_response (
      id TEXT PRIMARY KEY,
      template_slug TEXT NOT NULL,
      brief_slug TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS form_response_template_idx ON form_response (template_slug, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS image_blob (
      id TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      bytes BYTEA NOT NULL,
      filename TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE image_blob ADD COLUMN IF NOT EXISTS filename TEXT`;
  // Seed Rork brief if none exists
  const existing = await sql`SELECT slug FROM brief`;
  if (existing.length === 0) {
    await sql`
      INSERT INTO brief (slug, name, logo_url, overview)
      VALUES (${DEFAULT_BRIEF_SLUG}, 'Rork', '/rork-logo.png', ${sql.json(RORK_OVERVIEW as never)})
    `;
  } else {
    // Backfill Rork's overview if empty
    await sql`
      UPDATE brief SET overview = ${sql.json(RORK_OVERVIEW as never)}
      WHERE slug = ${DEFAULT_BRIEF_SLUG} AND overview IS NULL
    `;
  }
  await sql`
    UPDATE curation SET id = ${DEFAULT_BRIEF_SLUG}
    WHERE id = 'default'
      AND NOT EXISTS (SELECT 1 FROM curation WHERE id = ${DEFAULT_BRIEF_SLUG})
  `;
}

type BriefRow = {
  slug: string;
  name: string;
  logo_url: string | null;
  overview: BriefOverview | null;
  hook_categories: BriefHookCategory[] | null;
  created_at: Date;
  updated_at: Date;
};

function rowToBrief(r: BriefRow): Brief {
  return {
    slug: r.slug,
    name: r.name,
    logoUrl: r.logo_url,
    overview: r.overview,
    hookCategories: r.hook_categories,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const BRIEF_SELECT = `slug, name, logo_url, overview, hook_categories, created_at, updated_at`;

export async function listBriefs(): Promise<Brief[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<
    BriefRow[]
  >`SELECT slug, name, logo_url, overview, hook_categories, created_at, updated_at FROM brief ORDER BY created_at ASC`;
  return rows.map(rowToBrief);
}

export async function getBrief(slug: string): Promise<Brief | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<
    BriefRow[]
  >`SELECT slug, name, logo_url, overview, hook_categories, created_at, updated_at FROM brief WHERE slug = ${slug}`;
  if (rows.length === 0) return null;
  return rowToBrief(rows[0]);
}

export async function createBrief(input: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  overview?: BriefOverview | null;
  hookCategories?: BriefHookCategory[] | null;
}): Promise<Brief> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO brief (slug, name, logo_url, overview, hook_categories)
    VALUES (
      ${input.slug},
      ${input.name},
      ${input.logoUrl ?? null},
      ${input.overview ? sql.json(input.overview as never) : null},
      ${input.hookCategories ? sql.json(input.hookCategories as never) : null}
    )
  `;
  const b = await getBrief(input.slug);
  if (!b) throw new Error("Failed to create brief");
  return b;
}

export async function updateBrief(
  slug: string,
  patch: {
    name?: string;
    logoUrl?: string | null;
    slug?: string;
    overview?: BriefOverview | null;
    hookCategories?: BriefHookCategory[] | null;
  }
): Promise<Brief> {
  await ensureSchema();
  const sql = getSql();
  if (patch.slug && patch.slug !== slug) {
    await sql`UPDATE brief SET slug = ${patch.slug}, updated_at = NOW() WHERE slug = ${slug}`;
    await sql`UPDATE curation SET id = ${patch.slug} WHERE id = ${slug}`;
    slug = patch.slug;
  }
  if (patch.name !== undefined) {
    await sql`UPDATE brief SET name = ${patch.name}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.logoUrl !== undefined) {
    await sql`UPDATE brief SET logo_url = ${patch.logoUrl}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.overview !== undefined) {
    await sql`UPDATE brief SET overview = ${patch.overview ? sql.json(patch.overview as never) : null}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.hookCategories !== undefined) {
    await sql`UPDATE brief SET hook_categories = ${patch.hookCategories ? sql.json(patch.hookCategories as never) : null}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  const b = await getBrief(slug);
  if (!b) throw new Error("Brief not found after update");
  return b;
}

// Mark BRIEF_SELECT as used to keep linter happy if we remove inline SELECTs later
export { BRIEF_SELECT };

export async function duplicateBrief(input: {
  srcSlug: string;
  newSlug: string;
  newName: string;
  newLogoUrl?: string | null;
}): Promise<Brief> {
  await ensureSchema();
  const sql = getSql();
  const src = await getBrief(input.srcSlug);
  if (!src) throw new Error("Source brief not found");

  await sql`
    INSERT INTO brief (slug, name, logo_url, overview, hook_categories)
    VALUES (
      ${input.newSlug},
      ${input.newName},
      ${input.newLogoUrl !== undefined ? input.newLogoUrl : (src.logoUrl ?? null)},
      ${src.overview ? sql.json(src.overview as never) : null},
      ${src.hookCategories ? sql.json(src.hookCategories as never) : null}
    )
  `;

  // Copy curation row (per-brief pins / overrides / etc.) if present.
  const rows = await sql<{ data: CurationData }[]>`
    SELECT data FROM curation WHERE id = ${input.srcSlug}
  `;
  if (rows.length > 0) {
    await sql`
      INSERT INTO curation (id, data) VALUES (${input.newSlug}, ${sql.json(rows[0].data as never)})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
  }

  const b = await getBrief(input.newSlug);
  if (!b) throw new Error("Failed to duplicate brief");
  return b;
}

export async function copyFormatSection(input: {
  srcSlug: string;
  dstSlug: string;
  formatSlug: string;
}): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  const fSlug = input.formatSlug;

  const srcRows = await sql<{ data: CurationData }[]>`
    SELECT data FROM curation WHERE id = ${input.srcSlug}
  `;
  if (srcRows.length === 0) throw new Error("source curation not found");
  const src = srcRows[0].data;

  const dstRows = await sql<{ data: CurationData }[]>`
    SELECT data FROM curation WHERE id = ${input.dstSlug}
  `;
  if (dstRows.length === 0) throw new Error("destination curation not found");
  const dst = dstRows[0].data;

  const srcPins = src.formatPins?.[fSlug] ?? [];
  const next: CurationData = {
    ...dst,
    formatPins: { ...(dst.formatPins ?? {}), [fSlug]: [...srcPins] },
    formatBuckets: { ...(dst.formatBuckets ?? {}), [fSlug]: src.formatBuckets?.[fSlug] ?? null },
  };

  if (src.formatOverrides?.[fSlug] !== undefined) {
    next.formatOverrides = {
      ...(dst.formatOverrides ?? {}),
      [fSlug]: src.formatOverrides[fSlug],
    };
  }

  // Bring along video metadata referenced by the copied pins.
  if (srcPins.length && src.videoMetadata) {
    const mergedMeta = { ...(dst.videoMetadata ?? {}) };
    for (const id of srcPins) {
      if (src.videoMetadata[id] && !mergedMeta[id]) {
        mergedMeta[id] = src.videoMetadata[id];
      }
    }
    next.videoMetadata = mergedMeta;
  }

  // Ensure the section is visible in dst's order. If dst has an explicit
  // formatOrder and this slug isn't in it, append it.
  if (Array.isArray(dst.formatOrder) && !dst.formatOrder.includes(fSlug)) {
    next.formatOrder = [...dst.formatOrder, fSlug];
  }

  await sql`
    UPDATE curation SET data = ${sql.json(next as never)}, updated_at = NOW()
    WHERE id = ${input.dstSlug}
  `;
}

export async function cloneFormatInBrief(input: {
  briefSlug: string;
  sourceSlug: string;
}): Promise<{ newSlug: string }> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<{ data: CurationData }[]>`
    SELECT data FROM curation WHERE id = ${input.briefSlug}
  `;
  if (rows.length === 0) throw new Error("brief curation not found");
  const cur = rows[0].data;

  // Resolve the *base* meta source. Cloning a clone still references the
  // original static meta.
  const baseSourceSlug =
    cur.formatClones?.[input.sourceSlug] ?? input.sourceSlug;

  // Generate a unique slug.
  const taken = new Set<string>([
    ...Object.keys(cur.formatPins ?? {}),
    ...Object.keys(cur.formatOverrides ?? {}),
    ...Object.keys(cur.formatClones ?? {}),
    ...(cur.formatOrder ?? []),
    ...formatsMeta.map((f) => f.slug),
  ]);
  let newSlug = `${baseSourceSlug}-copy`;
  let n = 2;
  while (taken.has(newSlug)) {
    newSlug = `${baseSourceSlug}-copy-${n}`;
    n += 1;
  }

  const srcPins = cur.formatPins?.[input.sourceSlug] ?? [];
  const next: CurationData = {
    ...cur,
    formatPins: { ...(cur.formatPins ?? {}), [newSlug]: [...srcPins] },
    formatBuckets: {
      ...(cur.formatBuckets ?? {}),
      [newSlug]: cur.formatBuckets?.[input.sourceSlug] ?? null,
    },
    formatClones: {
      ...(cur.formatClones ?? {}),
      [newSlug]: baseSourceSlug,
    },
  };

  const srcOverride = cur.formatOverrides?.[input.sourceSlug];
  if (srcOverride !== undefined) {
    next.formatOverrides = {
      ...(cur.formatOverrides ?? {}),
      [newSlug]: srcOverride,
    };
  }

  // Build a full effective order so the clone appears immediately after
  // its source. If no explicit order exists, materialize one from
  // formatsMeta (the renderer's default).
  const baseOrder =
    cur.formatOrder && cur.formatOrder.length > 0
      ? cur.formatOrder
      : formatsMeta.map((f) => f.slug);
  const idx = baseOrder.indexOf(input.sourceSlug);
  const insertAt = idx === -1 ? baseOrder.length : idx + 1;
  next.formatOrder = [
    ...baseOrder.slice(0, insertAt),
    newSlug,
    ...baseOrder.slice(insertAt),
  ];

  await sql`
    UPDATE curation SET data = ${sql.json(next as never)}, updated_at = NOW()
    WHERE id = ${input.briefSlug}
  `;
  return { newSlug };
}

export async function deleteBrief(slug: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM curation WHERE id = ${slug}`;
  await sql`DELETE FROM brief WHERE slug = ${slug}`;
}

export async function getCuration(
  briefSlug: string = DEFAULT_BRIEF_SLUG
): Promise<CurationData> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<{ data: CurationData }[]>`
    SELECT data FROM curation WHERE id = ${briefSlug}
  `;
  if (rows.length === 0) {
    const seed =
      briefSlug === DEFAULT_BRIEF_SLUG
        ? await readSeedFromFile()
        : { ...DEFAULT_CURATION };
    await sql`
      INSERT INTO curation (id, data) VALUES (${briefSlug}, ${sql.json(seed as never)})
    `;
    return seed;
  }
  return rows[0].data;
}

export async function setCuration(
  next: CurationData,
  briefSlug: string = DEFAULT_BRIEF_SLUG
): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO curation (id, data, updated_at)
    VALUES (${briefSlug}, ${sql.json(next as never)}, NOW())
    ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

// ---------- Form templates ----------

export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "url"
  | "number"
  | "select"
  | "checkbox"
  | "password"
  | "image"
  | "account_list";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
};

export type FormTemplate = {
  slug: string;
  name: string;
  description: string | null;
  briefSlug: string | null;
  fields: FormField[];
  submitMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FormResponse = {
  id: string;
  templateSlug: string;
  briefSlug: string | null;
  data: Record<string, unknown>;
  createdAt: Date;
};

type FormTemplateRow = {
  slug: string;
  name: string;
  description: string | null;
  brief_slug: string | null;
  fields: FormField[] | null;
  submit_message: string | null;
  created_at: Date;
  updated_at: Date;
};

type FormResponseRow = {
  id: string;
  template_slug: string;
  brief_slug: string | null;
  data: Record<string, unknown>;
  created_at: Date;
};

function rowToFormTemplate(r: FormTemplateRow): FormTemplate {
  return {
    slug: r.slug,
    name: r.name,
    description: r.description,
    briefSlug: r.brief_slug,
    fields: Array.isArray(r.fields) ? r.fields : [],
    submitMessage: r.submit_message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToFormResponse(r: FormResponseRow): FormResponse {
  return {
    id: r.id,
    templateSlug: r.template_slug,
    briefSlug: r.brief_slug,
    data: r.data ?? {},
    createdAt: r.created_at,
  };
}

export async function listFormTemplates(): Promise<FormTemplate[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<FormTemplateRow[]>`
    SELECT slug, name, description, brief_slug, fields, submit_message, created_at, updated_at
    FROM form_template
    ORDER BY created_at DESC
  `;
  return rows.map(rowToFormTemplate);
}

export async function getFormTemplate(
  slug: string
): Promise<FormTemplate | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<FormTemplateRow[]>`
    SELECT slug, name, description, brief_slug, fields, submit_message, created_at, updated_at
    FROM form_template
    WHERE slug = ${slug}
  `;
  if (rows.length === 0) return null;
  return rowToFormTemplate(rows[0]);
}

export async function createFormTemplate(input: {
  slug: string;
  name: string;
  description?: string | null;
  briefSlug?: string | null;
  fields?: FormField[];
  submitMessage?: string | null;
}): Promise<FormTemplate> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO form_template (slug, name, description, brief_slug, fields, submit_message)
    VALUES (
      ${input.slug},
      ${input.name},
      ${input.description ?? null},
      ${input.briefSlug ?? null},
      ${sql.json((input.fields ?? []) as never)},
      ${input.submitMessage ?? null}
    )
  `;
  const t = await getFormTemplate(input.slug);
  if (!t) throw new Error("Failed to create form template");
  return t;
}

export async function updateFormTemplate(
  slug: string,
  patch: {
    slug?: string;
    name?: string;
    description?: string | null;
    briefSlug?: string | null;
    fields?: FormField[];
    submitMessage?: string | null;
  }
): Promise<FormTemplate> {
  await ensureSchema();
  const sql = getSql();
  if (patch.slug && patch.slug !== slug) {
    await sql`UPDATE form_template SET slug = ${patch.slug}, updated_at = NOW() WHERE slug = ${slug}`;
    await sql`UPDATE form_response SET template_slug = ${patch.slug} WHERE template_slug = ${slug}`;
    slug = patch.slug;
  }
  if (patch.name !== undefined) {
    await sql`UPDATE form_template SET name = ${patch.name}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.description !== undefined) {
    await sql`UPDATE form_template SET description = ${patch.description}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.briefSlug !== undefined) {
    await sql`UPDATE form_template SET brief_slug = ${patch.briefSlug}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.fields !== undefined) {
    await sql`UPDATE form_template SET fields = ${sql.json(patch.fields as never)}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.submitMessage !== undefined) {
    await sql`UPDATE form_template SET submit_message = ${patch.submitMessage}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  const t = await getFormTemplate(slug);
  if (!t) throw new Error("Form template not found after update");
  return t;
}

export async function deleteFormTemplate(slug: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM form_response WHERE template_slug = ${slug}`;
  await sql`DELETE FROM form_template WHERE slug = ${slug}`;
}

export async function listFormResponses(
  templateSlug: string
): Promise<FormResponse[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<FormResponseRow[]>`
    SELECT id, template_slug, brief_slug, data, created_at
    FROM form_response
    WHERE template_slug = ${templateSlug}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToFormResponse);
}

export async function countFormResponses(
  templateSlug: string
): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM form_response WHERE template_slug = ${templateSlug}
  `;
  return Number(rows[0]?.c ?? 0);
}

export async function createFormResponse(input: {
  templateSlug: string;
  briefSlug?: string | null;
  data: Record<string, unknown>;
}): Promise<FormResponse> {
  await ensureSchema();
  const sql = getSql();
  const id = `fr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO form_response (id, template_slug, brief_slug, data)
    VALUES (
      ${id},
      ${input.templateSlug},
      ${input.briefSlug ?? null},
      ${sql.json(input.data as never)}
    )
  `;
  const rows = await sql<FormResponseRow[]>`
    SELECT id, template_slug, brief_slug, data, created_at FROM form_response WHERE id = ${id}
  `;
  return rowToFormResponse(rows[0]);
}

export async function deleteFormResponse(id: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM form_response WHERE id = ${id}`;
}

// One-shot migration: walk a curation, extract any inline `data:` image
// URLs in formatOverrides, upload them to image_blob, replace with stable
// /api/uploads/{id} URLs. Returns the (possibly identical) curation and a
// count of images migrated. Idempotent — clean curations are a no-op.
export async function migrateInlineImagesInCuration(
  curation: CurationData
): Promise<{ curation: CurationData; migrated: number }> {
  const overrides = curation.formatOverrides;
  if (!overrides) return { curation, migrated: 0 };
  let migrated = 0;
  const nextOverrides: Record<string, FormatOverride> = {};
  for (const [slug, ov] of Object.entries(overrides)) {
    const cleanedOv: FormatOverride = { ...ov };
    for (const field of ["structure", "tips", "bestFor"] as const) {
      const items = ov[field];
      if (!Array.isArray(items)) continue;
      const newItems: FormatOverrideItem[] = [];
      for (const item of items) {
        if (item.image && item.image.startsWith("data:")) {
          const m = item.image.match(/^data:([\w./+-]+);base64,(.+)$/);
          if (m) {
            const bytes = Buffer.from(m[2], "base64");
            const { id } = await createImage(m[1], bytes);
            migrated++;
            newItems.push({ ...item, image: `/api/uploads/${id}` });
            continue;
          }
        }
        newItems.push(item);
      }
      cleanedOv[field] = newItems;
    }
    nextOverrides[slug] = cleanedOv;
  }
  return {
    curation: { ...curation, formatOverrides: nextOverrides },
    migrated,
  };
}

// ---------- Image blob storage ----------
// Stores images out-of-band so the curation JSON stays small. Inline
// base64 data URLs in curation/brief documents balloon the JSONB row to
// many MB, which makes every save/load round-trip slow.

export async function createImage(
  mime: string,
  bytes: Buffer,
  filename?: string
): Promise<{ id: string }> {
  await ensureSchema();
  const sql = getSql();
  const id = `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await sql`INSERT INTO image_blob (id, mime, bytes, filename) VALUES (${id}, ${mime}, ${bytes}, ${filename ?? null})`;
  return { id };
}

export async function getImage(
  id: string
): Promise<{ mime: string; bytes: Buffer; filename: string | null } | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<
    { mime: string; bytes: Buffer; filename: string | null }[]
  >`SELECT mime, bytes, filename FROM image_blob WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return rows[0];
}

async function readSeedFromFile(): Promise<CurationData> {
  try {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const p = path.join(process.cwd(), "data/curation.json");
    const raw = await readFile(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<CurationData>;
    return {
      exclude: parsed.exclude ?? [],
      formatPins: parsed.formatPins ?? DEFAULT_CURATION.formatPins,
      formatBuckets: parsed.formatBuckets ?? DEFAULT_CURATION.formatBuckets,
    };
  } catch {
    return DEFAULT_CURATION;
  }
}
