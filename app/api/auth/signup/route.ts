import { NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { SESSION_COOKIE, makeSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days — stay logged in

export async function POST(req: Request) {
  let body: { email?: string; password?: string; name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  try {
    const user = await createUser({ email, password, name });
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
    const msg = (e as Error).message;
    return NextResponse.json(
      { ok: false, error: msg.includes("registered") ? "That email already has an account — log in instead." : msg },
      { status: 400 }
    );
  }
}
