import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, destroyAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await destroyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
