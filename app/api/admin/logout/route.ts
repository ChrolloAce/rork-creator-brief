import { NextResponse } from "next/server";
import { adminCookieName } from "@/lib/admin-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName, "", { maxAge: 0, path: "/" });
  return res;
}
