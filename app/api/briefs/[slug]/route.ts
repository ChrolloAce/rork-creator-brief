import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteBrief,
  getBrief,
  updateBrief,
  DEFAULT_BRIEF_SLUG,
  type BriefOverview,
  type BriefHookCategory,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type Params = { slug: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const b = await getBrief(slug);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, brief: b });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  let body: {
    name?: string;
    slug?: string;
    logoUrl?: string | null;
    overview?: BriefOverview | null;
    hookCategories?: BriefHookCategory[] | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const patch: {
    name?: string;
    slug?: string;
    logoUrl?: string | null;
    overview?: BriefOverview | null;
    hookCategories?: BriefHookCategory[] | null;
  } = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.slug === "string") {
    const s = slugify(body.slug);
    if (!s) return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    patch.slug = s;
  }
  if (body.logoUrl !== undefined) {
    const trimmed = body.logoUrl?.trim() ?? "";
    patch.logoUrl = trimmed || null;
  }
  if (body.overview !== undefined) {
    patch.overview = body.overview;
  }
  if (body.hookCategories !== undefined) {
    patch.hookCategories = body.hookCategories;
  }
  try {
    const brief = await updateBrief(slug, patch);
    revalidatePath("/admin");
    revalidatePath(`/b/${brief.slug}`);
    return NextResponse.json({ ok: true, brief });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  if (slug === DEFAULT_BRIEF_SLUG) {
    return NextResponse.json(
      { error: "cannot delete the default Rork brief" },
      { status: 400 }
    );
  }
  try {
    await deleteBrief(slug);
    revalidatePath("/admin");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
