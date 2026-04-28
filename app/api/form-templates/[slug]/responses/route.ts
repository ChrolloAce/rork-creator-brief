import { NextResponse } from "next/server";
import { listFormResponses, getFormTemplate } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const template = await getFormTemplate(slug);
  if (!template) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const responses = await listFormResponses(slug);
  return NextResponse.json({ ok: true, template, responses });
}
