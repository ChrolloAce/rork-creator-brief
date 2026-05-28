import { NextResponse } from "next/server";
import { createImage } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 100 MB cap — videos can be large. Anything beyond this should go to
// dedicated object storage (S3/R2), but for the current usage Postgres
// bytea is fine.
const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  // multipart/form-data: file upload (videos, images). Preferred for any
  // non-trivial size — no base64 inflation.
  if (contentType.startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "invalid form data" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json(
        { error: `file too large: ${buf.length} bytes (max ${MAX_BYTES})` },
        { status: 413 }
      );
    }
    const mime = file.type || "application/octet-stream";
    try {
      const { id } = await createImage(mime, buf, file.name || undefined);
      return NextResponse.json({
        url: `/api/uploads/${id}`,
        id,
        mime,
        filename: file.name || null,
        size: buf.length,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  // Legacy JSON path: {dataUrl} → small images uploaded as base64.
  let body: { dataUrl?: string; filename?: string };
  try {
    body = (await req.json()) as { dataUrl?: string; filename?: string };
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
    const { id } = await createImage(mime, bytes, body.filename);
    return NextResponse.json({
      url: `/api/uploads/${id}`,
      id,
      mime,
      filename: body.filename ?? null,
      size: bytes.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
