import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName, verifyToken } from "@/lib/admin-auth";

// Protect /admin (except /admin/login) and /api/admin/* except /api/admin/login
// + /api/curation (only editable when authed).

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi =
    pathname.startsWith("/api/admin/") || pathname === "/api/curation";
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
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/curation"],
};
