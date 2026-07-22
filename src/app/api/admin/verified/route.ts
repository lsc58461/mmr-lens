import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import { listVerifiedSummoners, setVerifiedActive } from "@/lib/store";
import type { PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const items = await listVerifiedSummoners().catch(() => []);
  return NextResponse.json({ items });
}

// 인증 해제/복구 { platform, gameName, tagLine, active }
export async function POST(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    platform?: string;
    gameName?: string;
    tagLine?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.platform || !body.gameName || !body.tagLine) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  await setVerifiedActive(
    body.platform as PlatformRegion,
    body.gameName,
    body.tagLine,
    body.active === true,
  );
  return NextResponse.json({ ok: true });
}
