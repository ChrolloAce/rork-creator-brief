import { getImage } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDispositionFor(
  filename: string | null,
  asDownload: boolean
): string | undefined {
  if (!filename && !asDownload) return undefined;
  const disp = asDownload ? "attachment" : "inline";
  if (!filename) return disp;
  // RFC 5987 + ASCII fallback
  const ascii = filename.replace(/[^\x20-\x7e]+/g, "_").replace(/"/g, "");
  const utf8 = encodeURIComponent(filename);
  return `${disp}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const img = await getImage(id);
  if (!img) return new Response("not found", { status: 404 });

  const url = new URL(req.url);
  const asDownload = url.searchParams.get("download") === "1";
  const range = req.headers.get("range");
  const total = img.bytes.length;
  const baseHeaders: Record<string, string> = {
    "Content-Type": img.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  const disp = contentDispositionFor(img.filename, asDownload);
  if (disp) baseHeaders["Content-Disposition"] = disp;

  // Range request — required for <video> scrubbing/streaming.
  if (range) {
    const m = range.match(/^bytes=(\d+)-(\d*)$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      if (start <= end && start < total) {
        const chunk = img.bytes.subarray(start, end + 1);
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Content-Length": String(chunk.length),
          },
        });
      }
    }
    return new Response("range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  return new Response(new Uint8Array(img.bytes), {
    headers: {
      ...baseHeaders,
      "Content-Length": String(total),
    },
  });
}
