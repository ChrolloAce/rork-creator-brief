import "server-only";
import { cookies } from "next/headers";
import { adminCookieName, verifyToken } from "./admin-auth";
import { currentCreator } from "./brief-gate";
import { getCuration } from "./db";
import type { StudioConfig } from "./studio";

// Who is using the builder. Creators are their account; an admin (admin
// cookie, no creator session) gets a fixed pseudo-identity so the team can
// test the flow on the live brief without making a creator account.
export type StudioViewer = {
  id: string;
  name: string | null;
  email: string | null;
  isAdmin: boolean;
};

export const ADMIN_VIEWER_ID = "_admin";

export async function studioViewer(): Promise<StudioViewer | null> {
  const user = await currentCreator();
  if (user) {
    const jar = await cookies();
    const isAdmin = await verifyToken(jar.get(adminCookieName)?.value);
    return { id: user.id, name: user.name, email: user.email, isAdmin };
  }
  const jar = await cookies();
  if (await verifyToken(jar.get(adminCookieName)?.value)) {
    return { id: ADMIN_VIEWER_ID, name: "Admin", email: null, isAdmin: true };
  }
  return null;
}

// The brief's builder config, or null when the builder is off for it.
export async function studioConfigFor(slug: string): Promise<StudioConfig | null> {
  const cur = await getCuration(slug);
  const c = cur.studio;
  if (!c?.enabled) return null;
  return { ...c, hooks: Array.isArray(c.hooks) ? c.hooks : [] };
}
