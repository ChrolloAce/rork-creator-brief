import "server-only";
import postgres from "postgres";

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

export type FormatOverrideItem = { text: string; image?: string };
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
};

export type BriefHook = { text: string; note?: string };
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
