"use client";

import { useRef, useState } from "react";
import type { FormField } from "@/lib/db";

type Props = {
  slug: string;
  fields: FormField[];
  submitMessage: string | null;
};

export function PublicApplyForm({ slug, fields, submitMessage }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function setValue(id: string, v: unknown) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(
      `/api/form-templates/${encodeURIComponent(slug)}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values }),
      }
    );
    const j = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError(j.error ?? "Submission failed");
    }
  }

  if (done) {
    return (
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-6 sm:p-8 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
          Submitted
        </div>
        <h2 className="text-2xl font-black mb-2">Thanks!</h2>
        <p className="text-sm text-muted">
          {submitMessage ?? "We've received your application — we'll be in touch."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-6 space-y-5"
    >
      {fields.map((f) => (
        <FieldRow
          key={f.id}
          field={f}
          value={values[f.id]}
          onChange={(v) => setValue(f.id, v)}
        />
      ))}
      {fields.length === 0 && (
        <p className="text-sm text-muted italic">
          This form has no questions yet.
        </p>
      )}
      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button
          type="submit"
          disabled={submitting || fields.length === 0}
          className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-4 py-2 rounded-md nb-press disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        {error && (
          <span className="text-xs font-bold text-[#b91c1c]">{error}</span>
        )}
      </div>
    </form>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const baseLabel = (
    <span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
      {field.label}
      {field.required && <span className="text-[#b91c1c] ml-1">*</span>}
    </span>
  );

  const help = field.helpText ? (
    <span className="block text-[11px] text-muted mt-1">{field.helpText}</span>
  ) : null;

  if (field.type === "long_text") {
    return (
      <label className="block">
        {baseLabel}
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          rows={5}
          className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent bg-background leading-relaxed"
        />
        {help}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label className="block">
        {baseLabel}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent bg-background"
        >
          <option value="">— choose —</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {help}
      </label>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          required={field.required}
          className="w-5 h-5 border-2 border-line mt-0.5"
        />
        <span>
          <span className="block text-sm font-bold">
            {field.label}
            {field.required && (
              <span className="text-[#b91c1c] ml-1">*</span>
            )}
          </span>
          {help}
        </span>
      </label>
    );
  }
  if (field.type === "password") {
    return (
      <label className="block">
        {baseLabel}
        <input
          type="password"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          autoComplete="off"
          className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent bg-background"
        />
        {help}
      </label>
    );
  }
  if (field.type === "image") {
    return (
      <ImageField
        label={field.label}
        required={field.required}
        helpText={field.helpText}
        value={value as string | null | undefined}
        onChange={onChange}
      />
    );
  }
  if (field.type === "account_list") {
    return (
      <AccountListField
        label={field.label}
        required={field.required}
        helpText={field.helpText}
        value={
          Array.isArray(value)
            ? (value as { platform: string; handle: string }[])
            : []
        }
        onChange={onChange}
      />
    );
  }
  const inputType: string =
    field.type === "email"
      ? "email"
      : field.type === "url"
        ? "url"
        : field.type === "number"
          ? "number"
          : "text";
  return (
    <label className="block">
      {baseLabel}
      <input
        type={inputType}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        placeholder={field.placeholder}
        className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent bg-background"
      />
      {help}
    </label>
  );
}

const IMAGE_MAX_DIM = 768;
const IMAGE_MAX_RAW_BYTES = 8 * 1024 * 1024;

async function fileToResizedDataUrl(file: File): Promise<string> {
  if (file.size > IMAGE_MAX_RAW_BYTES) {
    throw new Error("File is larger than 8 MB.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    IMAGE_MAX_DIM / Math.max(bitmap.width, bitmap.height)
  );
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = mime === "image/jpeg" ? 0.85 : undefined;
  return canvas.toDataURL(mime, quality);
}

function ImageField({
  label,
  required,
  helpText,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  helpText?: string;
  value: string | null | undefined;
  onChange: (v: unknown) => void;
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
    <div className="block">
      <span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        {label}
        {required && <span className="text-[#b91c1c] ml-1">*</span>}
      </span>
      <div className="flex items-start gap-3 flex-wrap">
        <span
          className="w-20 h-20 border-2 border-line bg-paper rounded-sm overflow-hidden flex items-center justify-center shrink-0"
          aria-hidden
        >
          {value ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">
              None
            </span>
          )}
        </span>
        <div className="flex-1 min-w-[180px] space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2 flex-wrap">
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
            PNG, JPG, or WEBP · resized to 768px
          </p>
          {helpText && (
            <p className="text-[11px] text-muted">{helpText}</p>
          )}
          {err && <p className="text-xs text-[#b91c1c] font-bold">{err}</p>}
        </div>
      </div>
    </div>
  );
}

const ACCOUNT_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "X / Twitter",
  "Facebook",
  "Snapchat",
  "Other",
];

type AccountEntry = { platform: string; handle: string };

function AccountListField({
  label,
  required,
  helpText,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  helpText?: string;
  value: AccountEntry[];
  onChange: (v: AccountEntry[]) => void;
}) {
  const entries = value.length > 0 ? value : [{ platform: "Instagram", handle: "" }];

  function update(i: number, patch: Partial<AccountEntry>) {
    const next = entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    onChange(next);
  }
  function add() {
    onChange([...entries, { platform: "Instagram", handle: "" }]);
  }
  function remove(i: number) {
    const next = entries.filter((_, idx) => idx !== i);
    onChange(next);
  }

  return (
    <div className="block">
      <span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        {label}
        {required && <span className="text-[#b91c1c] ml-1">*</span>}
      </span>
      <ul className="space-y-2">
        {entries.map((e, i) => (
          <li key={i} className="flex gap-2 items-stretch">
            <select
              value={e.platform}
              onChange={(ev) => update(i, { platform: ev.target.value })}
              className="border-2 border-line rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent bg-background w-36"
            >
              {ACCOUNT_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={e.handle}
              onChange={(ev) => update(i, { handle: ev.target.value })}
              placeholder="@handle or full URL"
              className="flex-1 border-2 border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent bg-background"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove"
              disabled={entries.length === 1}
              className="border-2 border-line bg-background w-10 rounded-md nb-press font-black disabled:opacity-30"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-2 border-2 border-line bg-background text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press"
      >
        + Add account
      </button>
      {helpText && (
        <p className="text-[11px] text-muted mt-2">{helpText}</p>
      )}
    </div>
  );
}
