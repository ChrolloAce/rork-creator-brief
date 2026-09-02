import { NextResponse } from "next/server";
import { vtKey } from "@/lib/viewtrack";

// Every /api/vt route needs the server-side ViewTrack key. Missing key is a
// deployment problem, not a user error, so it answers 500 with a fixable
// message rather than a silent empty list.
export function requireVtKey():
  | { key: string; denied?: undefined }
  | { key?: undefined; denied: NextResponse } {
  const key = vtKey();
  if (!key) {
    return {
      denied: NextResponse.json(
        { ok: false, error: "VIEWTRACK_API_KEY is not set on this server" },
        { status: 500 }
      ),
    };
  }
  return { key };
}
