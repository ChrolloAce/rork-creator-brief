"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BriefAccountSetup,
  BriefAccountSetupPlatform,
  BriefOverview,
} from "@/lib/db";

const PROFILE_IMG_MAX_DIM = 1200;
const PROFILE_IMG_MAX_RAW_BYTES = 8 * 1024 * 1024;
async function resizeProfileImage(file: File): Promise<string> {
  if (file.size > PROFILE_IMG_MAX_RAW_BYTES) {
    throw new Error("File is >8MB — use a smaller source.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    PROFILE_IMG_MAX_DIM / Math.max(bitmap.width, bitmap.height)
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
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, mime === "image/jpeg" ? 0.85 : undefined);
}

function ProfileImagePicker({
  image,
  onChange,
}: {
  image?: string;
  onChange: (next: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const url = await resizeProfileImage(f);
            onChange(url);
          } catch (err) {
            alert((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {image ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            onClick={() => inputRef.current?.click()}
            className="block max-w-full max-h-64 object-contain border-2 border-line rounded-md bg-paper cursor-pointer"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Remove image"
            className="absolute -top-2 -right-2 w-6 h-6 bg-background border-2 border-line rounded-full text-xs font-black leading-none flex items-center justify-center"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="border-2 border-dashed border-line bg-paper rounded-md px-4 py-6 text-xs font-black uppercase tracking-widest text-muted hover:text-accent hover:border-accent disabled:opacity-40"
        >
          {busy ? "Processing…" : "+ Upload profile screenshot"}
        </button>
      )}
    </div>
  );
}

function AccountSetupSubEditor({
  value,
  onChange,
}: {
  value: BriefAccountSetup | undefined;
  onChange: (next: BriefAccountSetup | undefined) => void;
}) {
  const platforms = value?.platforms ?? [];
  const update = (next: BriefAccountSetup) => {
    const isEmpty =
      !next.intro?.trim() && (!next.platforms || next.platforms.length === 0);
    onChange(isEmpty ? undefined : next);
  };
  const patchPlatform = (
    idx: number,
    patch: Partial<BriefAccountSetupPlatform>
  ) => {
    const nextPlatforms = platforms.map((p, i) =>
      i === idx ? { ...p, ...patch } : p
    );
    update({ ...value, platforms: nextPlatforms });
  };
  const addPlatform = (name: string) => {
    update({
      ...value,
      platforms: [...platforms, { name }],
    });
  };
  const removePlatform = (idx: number) => {
    update({
      ...value,
      platforms: platforms.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="border-2 border-line bg-paper rounded-md p-3 sm:col-span-2 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
        Account setup ({platforms.length}{" "}
        {platforms.length === 1 ? "platform" : "platforms"})
      </div>
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Intro (overall guidance)
        </span>
        <textarea
          value={value?.intro ?? ""}
          onChange={(e) => update({ ...value, intro: e.target.value })}
          rows={3}
          placeholder="How creators should set up their accounts before posting…"
          className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
        />
      </label>
      {platforms.map((p, i) => (
        <div
          key={i}
          className="border-2 border-line bg-background rounded-md p-3 space-y-2"
        >
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              value={p.name}
              onChange={(e) => patchPlatform(i, { name: e.target.value })}
              placeholder="Platform name (e.g. Instagram)"
              className="flex-1 min-w-[160px] border-2 border-line rounded-md px-2 py-1.5 text-base font-black focus:outline-none focus:border-accent bg-background"
            />
            <button
              type="button"
              onClick={() => removePlatform(i)}
              className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-black"
            >
              × Remove
            </button>
          </div>
          <textarea
            value={p.notes ?? ""}
            onChange={(e) => patchPlatform(i, { notes: e.target.value })}
            rows={4}
            placeholder="What a good profile looks like — bio, profile pic, link, posting cadence…"
            className="w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
          <ProfileImagePicker
            image={p.image}
            onChange={(image) => patchPlatform(i, { image })}
          />
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        {!platforms.find((p) => p.name.toLowerCase() === "instagram") && (
          <button
            type="button"
            onClick={() => addPlatform("Instagram")}
            className="border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
          >
            + Instagram
          </button>
        )}
        {!platforms.find((p) => p.name.toLowerCase() === "tiktok") && (
          <button
            type="button"
            onClick={() => addPlatform("TikTok")}
            className="border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
          >
            + TikTok
          </button>
        )}
        <button
          type="button"
          onClick={() => addPlatform("")}
          className="border-2 border-dashed border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
        >
          + Other platform
        </button>
      </div>
    </div>
  );
}

export function OverviewEditor({
  value,
  onSave,
}: {
  value: BriefOverview | null | undefined;
  onSave: (next: BriefOverview) => Promise<void>;
}) {
  const [form, setForm] = useState<BriefOverview>(value ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(value ?? {});
    setDirty(false);
  }, [value]);

  function update<K extends keyof BriefOverview>(
    key: K,
    v: BriefOverview[K]
  ) {
    setForm((f) => ({ ...f, [key]: v }));
    setDirty(true);
  }

  function updateList(
    key: "valueProps" | "audience",
    text: string
  ) {
    const items = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    update(key, items);
  }

  async function submit() {
    setSaving(true);
    try {
      await onSave(form);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          Overview page content
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!dirty || saving}
          className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press text-xs disabled:opacity-40"
        >
          {saving ? "…" : "Save overview"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AccountSetupSubEditor
          value={form.accountSetup}
          onChange={(next) => update("accountSetup", next)}
        />
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Hero headline
          </span>
          <input
            type="text"
            value={form.heroHeadline ?? ""}
            onChange={(e) => update("heroHeadline", e.target.value)}
            placeholder="Ship content that ships apps."
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-lg font-black focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Hero accent word (highlighted)
          </span>
          <input
            type="text"
            value={form.heroAccentWord ?? ""}
            onChange={(e) => update("heroAccentWord", e.target.value)}
            placeholder="apps"
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Tagline
          </span>
          <input
            type="text"
            value={form.tagline ?? ""}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="Be the next one."
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Hero sub-text
          </span>
          <textarea
            value={form.heroSubtext ?? ""}
            onChange={(e) => update("heroSubtext", e.target.value)}
            rows={3}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Product heading
          </span>
          <input
            type="text"
            value={form.productHeading ?? ""}
            onChange={(e) => update("productHeading", e.target.value)}
            placeholder="What Rork is"
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Tagline sub-text
          </span>
          <input
            type="text"
            value={form.taglineSub ?? ""}
            onChange={(e) => update("taglineSub", e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Product description
          </span>
          <textarea
            value={form.productDescription ?? ""}
            onChange={(e) => update("productDescription", e.target.value)}
            rows={4}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Value props (one per line)
          </span>
          <textarea
            value={(form.valueProps ?? []).join("\n")}
            onChange={(e) => updateList("valueProps", e.target.value)}
            rows={5}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed font-mono"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Audience (one per line)
          </span>
          <textarea
            value={(form.audience ?? []).join("\n")}
            onChange={(e) => updateList("audience", e.target.value)}
            rows={5}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed font-mono"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            How to use (accent block)
          </span>
          <textarea
            value={form.howToUse ?? ""}
            onChange={(e) => update("howToUse", e.target.value)}
            rows={3}
            className="mt-1 w-full border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
          />
        </label>
      </div>
      {dirty && (
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mt-2">
          Unsaved changes
        </p>
      )}
    </section>
  );
}
