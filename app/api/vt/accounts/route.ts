import { NextResponse } from "next/server";
import { requireVtKey } from "../_key";
import { vtJson, vtPost } from "@/lib/viewtrack";

export const dynamic = "force-dynamic";

const PLATFORMS = ["instagram", "tiktok", "youtube", "x"] as const;
type Platform = (typeof PLATFORMS)[number];

type VtAccount = {
  id: string;
  username: string;
  platform: string;
  maxVideos: number;
  isExisting?: boolean;
  message?: string;
};

// POST /api/vt/accounts — start tracking an account inside a project.
// ViewTrack scrapes in the background; the response only confirms the job was
// dispatched, so the UI tells the admin to come back rather than pretending
// the videos are already there.
export async function POST(req: Request) {
  const { key, denied } = requireVtKey();
  if (denied) return denied;
  let body: {
    username?: string;
    platform?: string;
    projectId?: string;
    maxVideos?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const username = (body.username ?? "").trim().replace(/^@/, "");
  const platform = body.platform as Platform | undefined;
  if (!username) {
    return NextResponse.json(
      { ok: false, error: "Username is required" },
      { status: 400 }
    );
  }
  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { ok: false, error: `Platform must be one of ${PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!body.projectId) {
    return NextResponse.json(
      { ok: false, error: "Pick a project first" },
      { status: 400 }
    );
  }
  const r = await vtJson<VtAccount>(
    await vtPost("/accounts", key, {
      username,
      platform,
      projectId: body.projectId,
      // 25 is a deliberate default: enough recent posts to see a pattern
      // without burning a big slice of the org's daily scrape budget.
      maxVideos: Math.min(Math.max(body.maxVideos ?? 25, 1), 200),
    })
  );
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true, account: r.data });
}
