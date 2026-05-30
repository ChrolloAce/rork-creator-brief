import "server-only";
import { cookies } from "next/headers";
import { adminCookieName, verifyToken } from "./admin-auth";
import { SESSION_COOKIE, readSessionToken } from "./session";
import { getUserById, isApprovedForBrief } from "./db";
import type { Brief, CreatorUser } from "./db";

// The logged-in creator account (or null), read from the session cookie.
export async function currentCreator(): Promise<CreatorUser | null> {
  const jar = await cookies();
  const userId = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return getUserById(userId);
}

// Returns true when the visitor must be sent through onboarding before they can
// see the brief — i.e. the brief requires a code and they haven't both logged
// in and been approved. Admins (valid admin cookie) always pass. Approval is
// DB-backed, so removing a creator immediately revokes their access.
export async function briefAccessRequired(brief: Brief): Promise<boolean> {
  if (!brief.accessEnabled || !brief.accessCode) return false;
  const jar = await cookies();
  if (await verifyToken(jar.get(adminCookieName)?.value)) return false;
  const userId = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return true;
  return !(await isApprovedForBrief(brief.slug, userId));
}
