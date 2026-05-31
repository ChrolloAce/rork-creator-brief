import "server-only";
import { cookies } from "next/headers";
import { adminCookieName, verifyToken } from "./admin-auth";
import { SESSION_COOKIE, readSessionToken } from "./session";
import { accessCookieName, isAccessTokenValid } from "./creator-access";
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
// Does this visitor (as a creator, not admin) already have access to the gated
// brief? Login mode → logged in + approved in DB (removal revokes). Code-only
// mode → holds the access cookie from entering the right code.
export async function creatorHasAccess(brief: Brief): Promise<boolean> {
  if (!brief.accessEnabled || !brief.accessCode) return false;
  const jar = await cookies();
  if (brief.requireLogin) {
    const userId = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
    if (!userId) return false;
    return isApprovedForBrief(brief.slug, userId);
  }
  const cookieVal = jar.get(accessCookieName(brief.slug))?.value;
  return isAccessTokenValid(brief.slug, brief.accessCode, cookieVal);
}

export async function briefAccessRequired(brief: Brief): Promise<boolean> {
  if (!brief.accessEnabled || !brief.accessCode) return false;
  const jar = await cookies();
  if (await verifyToken(jar.get(adminCookieName)?.value)) return false;
  return !(await creatorHasAccess(brief));
}
