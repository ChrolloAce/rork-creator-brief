import "server-only";
import { cookies } from "next/headers";
import { accessCookieName, isAccessTokenValid } from "./creator-access";
import { adminCookieName, verifyToken } from "./admin-auth";
import type { Brief } from "./db";

// Returns true when the visitor must be sent through onboarding before they can
// see the brief — i.e. the brief requires a code and they haven't unlocked it.
// Admins (valid admin cookie) always pass so they can preview.
export async function briefAccessRequired(brief: Brief): Promise<boolean> {
  if (!brief.accessEnabled || !brief.accessCode) return false;
  const jar = await cookies();
  if (await verifyToken(jar.get(adminCookieName)?.value)) return false;
  const cookieVal = jar.get(accessCookieName(brief.slug))?.value;
  const ok = await isAccessTokenValid(brief.slug, brief.accessCode, cookieVal);
  return !ok;
}
