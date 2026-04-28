"use client";

import { useRef, useState } from "react";

const MAX_DIM = 256;
const MAX_RAW_BYTES = 5 * 1024 * 1024; // 5MB cap before resize

async function fileToResizedDataUrl(file: File): Promise<string> {
  if (file.size > MAX_RAW_BYTES) {
    throw new Error("File is >5MB — use a smaller source.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_DIM / Math.max(bitmap.width, bitmap.height)
  );
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  // PNG for transparency if source is png, jpeg otherwise
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = mime === "image/jpeg" ? 0.9 : undefined;
  return canvas.toDataURL(mime, quality);
}

export function LogoUpload({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const url = await fileToResizedDataUrl(file);
      onChange(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 flex-wrap">
      <span
        className="w-14 h-14 border-2 border-line bg-paper rounded-sm overflow-hidden flex items-center justify-center shrink-0"
        aria-hidden
      >
        {value ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={value}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">
            None
          </span>
        )}
      </span>
      <div className="flex-1 min-w-[180px] space-y-2">
        <div className="flex gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="border-2 border-line bg-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs disabled:opacity-40"
          >
            {busy ? "Processing…" : value ? "Replace" : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="border-2 border-line bg-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          PNG, JPG, WEBP or SVG · resized to 256px
        </p>
        {err && <p className="text-xs text-[#b91c1c] font-bold">{err}</p>}
      </div>
    </div>
  );
}
