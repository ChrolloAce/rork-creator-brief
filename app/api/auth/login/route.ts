import { NextResponse } from "next/server";
import { verifyLogin } from "@/lib/db";
import { SESSION_COOKIE, makeSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 60 * 60 * 24 * 180;

export async function POST(req: Request) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Enter your email and password." },
      { status: 400 }
    );
  }
  try {
    const user = await verifyLogin(email, password);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Wrong email or password." },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, await makeSessionToken(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
