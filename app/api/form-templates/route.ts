import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createFormTemplate,
  listFormTemplates,
  countFormResponses,
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

export async function GET() {
  try {
    const templates = await listFormTemplates();
    const counts = await Promise.all(
      templates.map((t) => countFormResponses(t.slug))
    );
    const withCounts = templates.map((t, i) => ({
      ...t,
      responseCount: counts[i],
    }));
    return NextResponse.json({ ok: true, templates: withCounts });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: {
    name?: string;
    slug?: string;
    description?: string;
    briefSlug?: string | null;
    fields?: FormField[];
    submitMessage?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const slug = slugify(body.slug ?? name);
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  try {
    const template = await createFormTemplate({
      slug,
      name,
      description: body.description?.trim() || null,
      briefSlug: body.briefSlug ?? null,
      fields: body.fields ?? [],
      submitMessage: body.submitMessage?.trim() || null,
    });
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, template });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg.includes("duplicate") ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
