import { NextResponse } from "next/server";
import { vtFetch, vtKey } from "@/lib/viewtrack";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = vtKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "VIEWTRACK_API_KEY not set" },
      { status: 500 }
    );
  }
  try {
    const res = await vtFetch("/projects", key);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `ViewTrack ${res.status}` },
        { status: 502 }
      );
    }
    const body = (await res.json()) as {
      success?: boolean;
      data?: {
        projects?: Array<{
          id: string;
          name: string;
          accountCount: number;
          videoCount: number;
          isArchived: boolean;
        }>;
      };
    };
    const projects = (body.data?.projects ?? [])
      .filter((p) => !p.isArchived)
      .map((p) => ({
        id: p.id,
        name: p.name,
        accountCount: p.accountCount,
        videoCount: p.videoCount,
      }));
    return NextResponse.json({ ok: true, projects });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
