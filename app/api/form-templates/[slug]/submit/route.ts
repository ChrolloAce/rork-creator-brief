import { NextResponse } from "next/server";
import {
  createFormResponse,
  getFormTemplate,
  type FormField,
} from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { slug: string };

function validate(field: FormField, raw: unknown): string | null {
  const isEmpty =
    raw === undefined ||
    raw === null ||
    (typeof raw === "string" && raw.trim() === "");
  if (field.required && isEmpty) {
    return `${field.label} is required`;
  }
  if (isEmpty) return null;
  if (field.type === "email" && typeof raw === "string") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
      return `${field.label} must be a valid email`;
    }
  }
  if (field.type === "url" && typeof raw === "string") {
    try {
      new URL(raw.trim());
    } catch {
      return `${field.label} must be a valid URL`;
    }
  }
  if (field.type === "number" && typeof raw === "string") {
    if (Number.isNaN(Number(raw))) {
      return `${field.label} must be a number`;
    }
  }
  if (field.type === "select" && typeof raw === "string") {
    if (field.options && field.options.length > 0 && !field.options.includes(raw)) {
      return `${field.label} must be one of the provided options`;
    }
  }
  return null;
}

function normalize(field: FormField, raw: unknown): unknown {
  if (raw === undefined || raw === null) return null;
  if (field.type === "checkbox") {
    return Boolean(raw);
  }
  if (field.type === "number" && typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "string") return raw.trim();
  return raw;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const template = await getFormTemplate(slug);
  if (!template) {
    return NextResponse.json({ error: "form not found" }, { status: 404 });
  }
  let body: { data?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const raw = body.data ?? {};
  const cleaned: Record<string, unknown> = {};
  for (const f of template.fields) {
    const err = validate(f, raw[f.id]);
    if (err) {
      return NextResponse.json({ ok: false, error: err }, { status: 400 });
    }
    cleaned[f.id] = normalize(f, raw[f.id]);
  }
  try {
    const response = await createFormResponse({
      templateSlug: slug,
      briefSlug: template.briefSlug,
      data: cleaned,
    });
    return NextResponse.json({ ok: true, id: response.id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
