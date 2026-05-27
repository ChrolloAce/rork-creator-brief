import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_BRIEF_SLUG,
  getCuration,
  setCuration,
  type CurationData,
} from "@/lib/db";
import { formats as formatsMeta } from "@/lib/formats";
import { getAdminPreview } from "@/lib/format-videos";

export const dynamic = "force-dynamic";

function briefFromUrl(url: string): string {
  const { searchParams } = new URL(url);
  return searchParams.get("brief") ?? DEFAULT_BRIEF_SLUG;
}

export async function GET(req: Request) {
  try {
    const briefSlug = briefFromUrl(req.url);
    const [curation, preview] = await Promise.all([
      getCuration(briefSlug),
      getAdminPreview(briefSlug),
    ]);
    return NextResponse.json({ ok: true, curation, preview, briefSlug });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const briefSlug = briefFromUrl(req.url);
  let body: { curation?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const next = body.curation as CurationData | undefined;
  if (
    !next ||
    typeof next !== "object" ||
    !Array.isArray(next.exclude) ||
    typeof next.formatPins !== "object" ||
    typeof next.formatBuckets !== "object"
  ) {
    return NextResponse.json(
      { error: "invalid curation payload" },
      { status: 400 }
    );
  }
  try {
    // Heavy `videoMetadata` (often multi-MB) is omitted by the admin client
    // on routine saves to stay under proxy body limits — preserve whatever
    // is already in the DB when it isn't sent.
    if (next.videoMetadata === undefined) {
      const existing = await getCuration(briefSlug);
      if (existing.videoMetadata) next.videoMetadata = existing.videoMetadata;
    }
    await setCuration(next, briefSlug);
    revalidatePath(`/b/${briefSlug}`);
    for (const f of formatsMeta)
      revalidatePath(`/b/${briefSlug}/formats/${f.slug}`);
    // Legacy root also refreshes for the default brief
    if (briefSlug === DEFAULT_BRIEF_SLUG) {
      revalidatePath("/");
      for (const f of formatsMeta) revalidatePath(`/formats/${f.slug}`);
    }
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
