import "server-only";
import postgres from "postgres";
import { formats as formatsMeta } from "./formats";
import type { VideoExample } from "./types";
import type { ScriptVariant } from "./scripts";
import { hashPassword, verifyPassword } from "./passwords";

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
  kind?: "overlay" | "asset" | "verse";
  verseRef?: string;
  verseText?: string;
  verseVersion?: string;
};
export type FormatOverride = {
  title?: string;
  tagline?: string;
  description?: string;
  // Legacy single script. Kept in sync with the live script variant so
  // back-compat readers (public page, v1 API) keep working. New writes go
  // through `scriptVariants`; this mirrors the first live variant's body.
  script?: string;
  // Multiple script versions for A/B testing — see lib/scripts.ts.
  scriptVariants?: ScriptVariant[];
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

// ---------- Onboarding (multi-step intro flow) ----------
export type OnboardingQuestionType = "short" | "long" | "select" | "checkbox";

export type OnboardingReview = {
  author: string;
  rating: number;
  title?: string;
  body: string;
};

export type OnboardingBlock =
  | { kind: "text"; id: string; text: string }
  | { kind: "image"; id: string; url: string; caption?: string }
  | { kind: "video"; id: string; url: string; caption?: string }
  | {
      kind: "question";
      id: string;
      label: string;
      field: OnboardingQuestionType;
      required?: boolean;
      placeholder?: string;
      options?: string[];
    }
  // ViewTrack example videos pinned into the step.
  | { kind: "videos"; id: string; videos: VideoExample[]; heading?: string }
  // App Store reviews (snapshotted from the iTunes API at edit time), with an
  // optional App Store-style app card header (logo, title, subtitle, rating).
  | {
      kind: "reviews";
      id: string;
      appId?: string;
      appName?: string;
      country?: string;
      appIcon?: string;
      appSubtitle?: string;
      appRating?: number;
      appRatingCount?: number;
      showCard?: boolean;
      reviews: OnboardingReview[];
    };

export type OnboardingStep = {
  id: string;
  title?: string;
  subtitle?: string;
  blocks: OnboardingBlock[];
};

// Final "approval gate" shown at the end of onboarding when the brief requires
// a code. Creators read the instructions (e.g. message us on WhatsApp), then
// enter the code to unlock the brief.
export type OnboardingGate = {
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type Onboarding = {
  enabled?: boolean;
  steps: OnboardingStep[];
  gate?: OnboardingGate;
};

export type Brief = {
  slug: string;
  name: string;
  logoUrl: string | null;
  overview: BriefOverview | null;
  hookCategories: BriefHookCategory[] | null;
  onboarding: Onboarding | null;
  // Creator-access gate. accessCode is the shared passcode; accessEnabled
  // controls whether the public brief actually requires it (kept false until
  // we go live with the gate).
  accessCode: string | null;
  accessEnabled: boolean;
  // When gated, also require an email+password account (not just the code).
  requireLogin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatorStatus = "onboarded" | "approved";

export type BriefCreator = {
  id: string;
  briefSlug: string;
  name: string;
  email: string | null;
  code: string | null;
  answers: Record<string, unknown>;
  status: CreatorStatus;
  clientId: string | null;
  createdAt: Date;
};

export type CreatorUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
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
  // Creator-access gate (passcode + name). Dormant until access_enabled flips on.
  await sql`ALTER TABLE brief ADD COLUMN IF NOT EXISTS access_code TEXT`;
  await sql`ALTER TABLE brief ADD COLUMN IF NOT EXISTS access_enabled BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE brief ADD COLUMN IF NOT EXISTS require_login BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE brief ADD COLUMN IF NOT EXISTS onboarding JSONB`;
  await sql`
    CREATE TABLE IF NOT EXISTS brief_creator (
      id TEXT PRIMARY KEY,
      brief_slug TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS brief_creator_brief_idx ON brief_creator (brief_slug, created_at DESC)`;
  // status: "onboarded" (finished onboarding) vs "approved" (entered the code).
  await sql`ALTER TABLE brief_creator ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved'`;
  await sql`ALTER TABLE brief_creator ADD COLUMN IF NOT EXISTS client_id TEXT`;
  await sql`ALTER TABLE brief_creator ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`ALTER TABLE brief_creator ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE brief_creator ADD COLUMN IF NOT EXISTS user_id TEXT`;
  // Site-wide creator accounts (email + password). One login works everywhere.
  await sql`
    CREATE TABLE IF NOT EXISTS creator_user (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
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
  access_code: string | null;
  access_enabled: boolean | null;
  require_login: boolean | null;
  onboarding: Onboarding | null;
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
    accessCode: r.access_code,
    accessEnabled: !!r.access_enabled,
    requireLogin: r.require_login !== false,
    onboarding: r.onboarding,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const BRIEF_SELECT = `slug, name, logo_url, overview, hook_categories, access_code, access_enabled, require_login, onboarding, created_at, updated_at`;

export async function listBriefs(): Promise<Brief[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<
    BriefRow[]
  >`SELECT slug, name, logo_url, overview, hook_categories, access_code, access_enabled, require_login, onboarding, created_at, updated_at FROM brief ORDER BY created_at ASC`;
  return rows.map(rowToBrief);
}

// Briefs a logged-in creator has been approved for (their dashboard). Joins
// the approved brief_creator rows back to the brief table; DISTINCT because a
// creator can have more than one row per brief (e.g. re-onboarded).
export async function briefsForCreator(userId: string): Promise<Brief[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<BriefRow[]>`
    SELECT DISTINCT b.slug, b.name, b.logo_url, b.overview, b.hook_categories,
      b.access_code, b.access_enabled, b.require_login, b.onboarding,
      b.created_at, b.updated_at
    FROM brief b
    JOIN brief_creator bc ON bc.brief_slug = b.slug
    WHERE bc.user_id = ${userId} AND bc.status = 'approved'
    ORDER BY b.updated_at DESC
  `;
  return rows.map(rowToBrief);
}

export async function getBrief(slug: string): Promise<Brief | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<
    BriefRow[]
  >`SELECT slug, name, logo_url, overview, hook_categories, access_code, access_enabled, require_login, onboarding, created_at, updated_at FROM brief WHERE slug = ${slug}`;
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
    accessCode?: string | null;
    accessEnabled?: boolean;
    requireLogin?: boolean;
    onboarding?: Onboarding | null;
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
  if (patch.accessCode !== undefined) {
    const trimmed = patch.accessCode?.trim() || null;
    await sql`UPDATE brief SET access_code = ${trimmed}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.accessEnabled !== undefined) {
    await sql`UPDATE brief SET access_enabled = ${patch.accessEnabled}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.requireLogin !== undefined) {
    await sql`UPDATE brief SET require_login = ${patch.requireLogin}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  if (patch.onboarding !== undefined) {
    await sql`UPDATE brief SET onboarding = ${patch.onboarding ? sql.json(patch.onboarding as never) : null}, updated_at = NOW() WHERE slug = ${slug}`;
  }
  const b = await getBrief(slug);
  if (!b) throw new Error("Brief not found after update");
  return b;
}

// ---------- Creator access (passcode + name gate) ----------

function rowToCreator(r: {
  id: string;
  brief_slug: string;
  name: string;
  email: string | null;
  code: string | null;
  answers: Record<string, unknown> | null;
  status: string | null;
  client_id: string | null;
  created_at: Date;
}): BriefCreator {
  return {
    id: r.id,
    briefSlug: r.brief_slug,
    name: r.name,
    email: r.email,
    code: r.code,
    answers: r.answers ?? {},
    status: r.status === "approved" ? "approved" : "onboarded",
    clientId: r.client_id,
    createdAt: r.created_at,
  };
}

const CREATOR_COLS = `id, brief_slug, name, email, code, answers, status, client_id, created_at`;

// Does the submitted code match the brief's passcode? (Empty brief code = any.)
export async function verifyBriefCode(
  briefSlug: string,
  code: string
): Promise<boolean> {
  const brief = await getBrief(briefSlug);
  if (!brief) return false;
  const expected = (brief.accessCode ?? "").trim();
  if (!expected) return true;
  return code.trim() === expected;
}

// Record/update a creator. Deduped by clientId (same device) so a creator who
// finishes onboarding ("onboarded") and later enters the code ("approved")
// updates one row instead of creating two. Never downgrades approved→onboarded.
export async function upsertCreator(input: {
  briefSlug: string;
  name: string;
  email?: string | null;
  code?: string;
  answers?: Record<string, unknown>;
  status: CreatorStatus;
  clientId?: string;
  userId?: string | null;
}): Promise<BriefCreator> {
  await ensureSchema();
  const sql = getSql();
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() || null;
  const code = input.code?.trim() || null;
  const userId = input.userId ?? null;
  const answers = input.answers ?? {};

  if (input.clientId) {
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM brief_creator
      WHERE brief_slug = ${input.briefSlug} AND client_id = ${input.clientId}
      LIMIT 1
    `;
    if (existing.length > 0) {
      await sql`
        UPDATE brief_creator SET
          name = ${name},
          email = COALESCE(${email}, email),
          user_id = COALESCE(${userId}, user_id),
          code = COALESCE(${code}, code),
          answers = ${sql.json(answers as never)},
          status = CASE WHEN status = 'approved' THEN 'approved' ELSE ${input.status} END,
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      const rows = await sql<Parameters<typeof rowToCreator>[0][]>`
        SELECT ${sql.unsafe(CREATOR_COLS)} FROM brief_creator WHERE id = ${existing[0].id}
      `;
      return rowToCreator(rows[0]);
    }
  }

  const id = `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO brief_creator (id, brief_slug, name, email, user_id, code, answers, status, client_id)
    VALUES (${id}, ${input.briefSlug}, ${name}, ${email}, ${userId}, ${code}, ${sql.json(answers as never)}, ${input.status}, ${input.clientId ?? null})
  `;
  const rows = await sql<Parameters<typeof rowToCreator>[0][]>`
    SELECT ${sql.unsafe(CREATOR_COLS)} FROM brief_creator WHERE id = ${id}
  `;
  return rowToCreator(rows[0]);
}

// Is this logged-in user approved for the brief? (DB-backed so revoking a
// creator immediately locks them out, code required again.)
export async function isApprovedForBrief(
  briefSlug: string,
  userId: string
): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM brief_creator
    WHERE brief_slug = ${briefSlug} AND user_id = ${userId} AND status = 'approved'
    LIMIT 1
  `;
  return rows.length > 0;
}

// ---------- Creator accounts (site-wide email + password) ----------

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Date;
};
function rowToUser(r: UserRow): CreatorUser {
  return { id: r.id, email: r.email, name: r.name, createdAt: r.created_at };
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<CreatorUser> {
  await ensureSchema();
  const sql = getSql();
  const email = input.email.trim().toLowerCase();
  const existing = await sql`SELECT id FROM creator_user WHERE email = ${email}`;
  if (existing.length > 0) throw new Error("email already registered");
  const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO creator_user (id, email, password_hash, name)
    VALUES (${id}, ${email}, ${hashPassword(input.password)}, ${input.name?.trim() || null})
  `;
  const rows = await sql<UserRow[]>`SELECT id, email, password_hash, name, created_at FROM creator_user WHERE id = ${id}`;
  return rowToUser(rows[0]);
}

export async function verifyLogin(
  email: string,
  password: string
): Promise<CreatorUser | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    SELECT id, email, password_hash, name, created_at FROM creator_user
    WHERE email = ${email.trim().toLowerCase()}
  `;
  if (rows.length === 0) return null;
  if (!verifyPassword(password, rows[0].password_hash)) return null;
  return rowToUser(rows[0]);
}

export async function getUserById(id: string): Promise<CreatorUser | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    SELECT id, email, password_hash, name, created_at FROM creator_user WHERE id = ${id}
  `;
  return rows.length ? rowToUser(rows[0]) : null;
}

export async function listCreators(briefSlug: string): Promise<BriefCreator[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<Parameters<typeof rowToCreator>[0][]>`
    SELECT ${sql.unsafe(CREATOR_COLS)}
    FROM brief_creator WHERE brief_slug = ${briefSlug}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToCreator);
}

export async function deleteCreator(id: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM brief_creator WHERE id = ${id}`;
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
