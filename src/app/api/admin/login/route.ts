import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, createAdminSession, verifyAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password || !(await verifyAdmin(username, password))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
