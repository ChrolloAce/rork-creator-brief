import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName, verifyToken } from "@/lib/admin-auth";

// Protect /admin (except /admin/login) and /api/admin/* except /api/admin/login
// + /api/curation (only editable when authed).

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isFormTemplatesApi =
    pathname === "/api/form-templates" ||
    pathname.startsWith("/api/form-templates/");
  // public submit endpoint: /api/form-templates/[slug]/submit
  const isPublicSubmit =
    isFormTemplatesApi && /\/submit\/?$/.test(pathname);
  // /api/v1/* is the external bearer-token API; it does its own auth and
  // must NOT be gated by the admin cookie.
  const isV1Api = pathname.startsWith("/api/v1/");
  const isAdminApi =
    !isV1Api &&
    (pathname.startsWith("/api/admin/") ||
      pathname === "/api/curation" ||
      pathname === "/api/briefs" ||
      pathname.startsWith("/api/briefs/") ||
      pathname === "/api/vt-projects" ||
      pathname === "/api/vt-search" ||
      pathname.startsWith("/api/ai/") ||
      pathname === "/api/uploads" ||
      (isFormTemplatesApi && !isPublicSubmit));
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  // allow login endpoints
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(adminCookieName)?.value;
  const ok = await verifyToken(token);
  if (!ok) {
    if (isAdminApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/curation",
    "/api/briefs",
    "/api/briefs/:path*",
    "/api/vt-projects",
    "/api/vt-search",
    "/api/ai/:path*",
    "/api/uploads",
    "/api/form-templates",
    "/api/form-templates/:path*",
  ],
};
