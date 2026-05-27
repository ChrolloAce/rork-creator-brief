import { NextResponse } from "next/server";
import { createImage } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB raw; client should resize first

export async function POST(req: Request) {
  let body: { dataUrl?: string };
  try {
    body = (await req.json()) as { dataUrl?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.dataUrl || typeof body.dataUrl !== "string") {
    return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
  }
  const m = body.dataUrl.match(/^data:([\w./+-]+);base64,(.+)$/);
  if (!m) {
    return NextResponse.json({ error: "expected base64 data URL" }, { status: 400 });
  }
  const mime = m[1];
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `image too large: ${bytes.length} bytes (max ${MAX_BYTES})` },
      { status: 413 }
    );
  }
  try {
    const { id } = await createImage(mime, bytes);
    return NextResponse.json({ url: `/api/uploads/${id}`, id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
