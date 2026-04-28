import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteFormTemplate,
  getFormTemplate,
  updateFormTemplate,
  type FormField,
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
  const t = await getFormTemplate(slug);
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, template: t });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  let body: {
    name?: string;
    slug?: string;
    description?: string | null;
    briefSlug?: string | null;
    fields?: FormField[];
    submitMessage?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const patch: {
    name?: string;
    slug?: string;
    description?: string | null;
    briefSlug?: string | null;
    fields?: FormField[];
    submitMessage?: string | null;
  } = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.slug === "string") {
    const s = slugify(body.slug);
    if (!s) return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    patch.slug = s;
  }
  if (body.description !== undefined) {
    const trimmed =
      typeof body.description === "string" ? body.description.trim() : "";
    patch.description = trimmed || null;
  }
  if (body.briefSlug !== undefined) {
    patch.briefSlug = body.briefSlug || null;
  }
  if (body.fields !== undefined) {
    patch.fields = body.fields;
  }
  if (body.submitMessage !== undefined) {
    const trimmed =
      typeof body.submitMessage === "string"
        ? body.submitMessage.trim()
        : "";
    patch.submitMessage = trimmed || null;
  }
  try {
    const template = await updateFormTemplate(slug, patch);
    revalidatePath("/admin");
    revalidatePath(`/admin/forms/${template.slug}`);
    revalidatePath(`/apply/${template.slug}`);
    return NextResponse.json({ ok: true, template });
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
  try {
    await deleteFormTemplate(slug);
    revalidatePath("/admin");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
