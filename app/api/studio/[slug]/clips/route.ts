import { NextResponse } from "next/server";
import { countStudioClips, createStudioClip, deleteStudioClip, upsertCreator } from "@/lib/db";
import { STUDIO_DEFAULTS } from "@/lib/studio";
import { ADMIN_VIEWER_ID } from "@/lib/studio-auth";
import { ingestClip, spoolUpload } from "@/lib/studio-worker";
import { studioContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/studio/{slug}/clips?filename=demo.mov[&label=..][&kind=broll|example|showcase]
// Body is the raw video bytes (not multipart) so it streams to disk instead
// of being buffered in memory. Responds as soon as the bytes are on disk;
// normalizing runs in the background and the client polls /state.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await studioContext(slug);
  if (!ctx.ok) return ctx.res;
  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam === "broll"
      ? "broll"
      : kindParam === "example"
        ? "example"
        : kindParam === "showcase"
          ? "showcase"
          : "demo";
  if (kind !== "demo" && !ctx.viewer.isAdmin) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const filename = (url.searchParams.get("filename") ?? "").slice(0, 120) || null;
  const label = (url.searchParams.get("label") ?? "").trim().slice(0, 80) || null;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > STUDIO_DEFAULTS.maxUploadBytes) {
    return NextResponse.json({ error: "That file is too large." }, { status: 413 });
  }
  if (!req.body) return NextResponse.json({ error: "no file" }, { status: 400 });

  if (kind === "demo") {
    const n = await countStudioClips(slug, ctx.viewer.id, "demo");
    if (n >= STUDIO_DEFAULTS.demoCap) {
      return NextResponse.json(
        { error: `You can keep up to ${STUDIO_DEFAULTS.demoCap} demos. Delete one first.` },
        { status: 400 }
      );
    }
  }

  const ext = (filename?.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".mp4").toLowerCase();
  let spooled: Awaited<ReturnType<typeof spoolUpload>>;
  try {
    spooled = await spoolUpload(req.body, ext, STUDIO_DEFAULTS.maxUploadBytes);
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json(
      { error: msg === "too large" ? "That file is too large." : "Upload failed. Try again." },
      { status: msg === "too large" ? 413 : 400 }
    );
  }
  if (spooled.bytes < 1000) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  const clip = await createStudioClip({
    briefSlug: slug,
    kind,
    userId: kind === "demo" ? ctx.viewer.id : ADMIN_VIEWER_ID,
    label,
    filename,
  });
  // A creator who uploads work is a creator on this brief: put them on the
  // roster so the admin's Creators tab shows them alongside everyone else.
  if (kind === "demo" && ctx.viewer.id !== ADMIN_VIEWER_ID && ctx.viewer.email) {
    void upsertCreator({
      briefSlug: slug,
      name: ctx.viewer.name || ctx.viewer.email,
      email: ctx.viewer.email,
      userId: ctx.viewer.id,
      status: "approved",
    }).catch(() => {});
  }
  void ingestClip({ clipId: clip.id, kind, dir: spooled.dir, file: spooled.file, filename });
  return NextResponse.json({ ok: true, clip });
}

// Bulk delete is not exposed; one clip at a time keeps mistakes small.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await studioContext(slug);
  if (!ctx.ok) return ctx.res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const { getStudioClip } = await import("@/lib/db");
  const clip = await getStudioClip(id);
  if (!clip || clip.briefSlug !== slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const mine = clip.userId === ctx.viewer.id;
  if (!mine && !ctx.viewer.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await deleteStudioClip(id);
  return NextResponse.json({ ok: true });
}
