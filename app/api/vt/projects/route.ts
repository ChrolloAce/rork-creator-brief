import { NextResponse } from "next/server";
import { requireVtKey } from "../_key";
import { vtFetch, vtJson, vtPost } from "@/lib/viewtrack";

export const dynamic = "force-dynamic";

type VtProject = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  accountCount?: number;
  videoCount?: number;
  isArchived?: boolean;
};

// GET /api/vt/projects — every non-archived ViewTrack project on the account.
// Same shape as the older /api/vt-projects, plus description/color so the
// research tab can render a project card rather than a bare chip.
export async function GET() {
  const { key, denied } = requireVtKey();
  if (denied) return denied;
  const r = await vtJson<{ projects?: VtProject[] }>(
    await vtFetch("/projects", key)
  );
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
  }
  const projects = (r.data.projects ?? [])
    .filter((p) => !p.isArchived)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      color: p.color ?? null,
      accountCount: p.accountCount ?? 0,
      videoCount: p.videoCount ?? 0,
    }));
  return NextResponse.json({ ok: true, projects });
}

// POST /api/vt/projects — create a ViewTrack project. Names are unique per
// org on ViewTrack's side; a clash comes back as a 409 with its own message,
// which is passed through unchanged.
export async function POST(req: Request) {
  const { key, denied } = requireVtKey();
  if (denied) return denied;
  let body: { name?: string; description?: string; color?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Give the project a name" },
      { status: 400 }
    );
  }
  const r = await vtJson<VtProject>(
    await vtPost("/projects", key, {
      name,
      ...(body.description?.trim() ? { description: body.description.trim() } : {}),
      // ViewTrack validates hex; anything else is dropped rather than 400'd.
      ...(/^#[0-9a-fA-F]{6}$/.test(body.color ?? "") ? { color: body.color } : {}),
    })
  );
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true, project: r.data });
}
