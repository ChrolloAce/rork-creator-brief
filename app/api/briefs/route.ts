import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createBrief, listBriefs } from "@/lib/db";

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
    const briefs = await listBriefs();
    return NextResponse.json({ ok: true, briefs });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: { name?: string; slug?: string; logoUrl?: string } = {};
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
    const brief = await createBrief({
      slug,
      name,
      logoUrl: body.logoUrl?.trim() || null,
    });
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, brief });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg.includes("duplicate") ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
