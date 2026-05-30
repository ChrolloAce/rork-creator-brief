import "server-only";
import { cookies } from "next/headers";
import { accessCookieName, isAccessTokenValid } from "./creator-access";
import { adminCookieName, verifyToken } from "./admin-auth";
import { SESSION_COOKIE, readSessionToken } from "./session";
import { getUserById } from "./db";
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
// in and entered the code. Admins (valid admin cookie) always pass.
export async function briefAccessRequired(brief: Brief): Promise<boolean> {
  if (!brief.accessEnabled || !brief.accessCode) return false;
  const jar = await cookies();
  if (await verifyToken(jar.get(adminCookieName)?.value)) return false;
  // Must be logged in...
  const userId = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return true;
  // ...and have entered this brief's code.
  const cookieVal = jar.get(accessCookieName(brief.slug))?.value;
  const ok = await isAccessTokenValid(brief.slug, brief.accessCode, cookieVal);
  return !ok;
}
