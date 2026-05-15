import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { duplicateBrief, getBrief } from "@/lib/db";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug: srcSlug } = await params;
  const src = await getBrief(srcSlug);
  if (!src) {
    return NextResponse.json({ error: "source brief not found" }, { status: 404 });
  }

  let body: { name?: string; slug?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore — fall back to derived defaults
  }
  const newName = (body.name ?? `${src.name} (copy)`).trim();
  if (!newName) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const newSlug = slugify(body.slug ?? newName);
  if (!newSlug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (newSlug === srcSlug) {
    return NextResponse.json(
      { error: "new slug must differ from source" },
      { status: 400 }
    );
  }

  try {
    const brief = await duplicateBrief({
      srcSlug,
      newSlug,
      newName,
    });
    revalidatePath("/admin");
    revalidatePath(`/b/${brief.slug}`);
    return NextResponse.json({ ok: true, brief });
  } catch (e) {
    const msg = (e as Error).message;
    const status =
      msg.toLowerCase().includes("duplicate") ||
      msg.toLowerCase().includes("unique") ||
      msg.toLowerCase().includes("conflict")
        ? 409
        : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
