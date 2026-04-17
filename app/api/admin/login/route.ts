import { NextResponse } from "next/server";
import { adminCookieName, checkPassword, issueToken } from "@/lib/admin-auth";

export async function POST(req: Request) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const password = body.password ?? "";
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD not configured" },
      { status: 500 }
    );
  }
  if (!checkPassword(password)) {
    return NextResponse.json(
      { error: "invalid password" },
      { status: 401 }
    );
  }
  const res = NextResponse.json({ ok: true });
  const token = await issueToken();
  res.cookies.set(adminCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
  return res;
}
