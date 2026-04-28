"use client";

import { useState } from "react";
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
  const inputType =
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
