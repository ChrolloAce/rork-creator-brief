import { getImage } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const img = await getImage(id);
  if (!img) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
