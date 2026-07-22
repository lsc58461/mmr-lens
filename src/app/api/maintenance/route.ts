import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

const KEY = "maintenance:flag";
const TTL = 60 * 60 * 24 * 365; // 끄기 전까지 유지

export async function GET() {
  const on = (await cache.get<boolean>(KEY)) === true;
  return NextResponse.json(
    { on },
    { headers: { "Cache-Control": "public, max-age=10" } },
  );
}

// 어드민 전용 토글
export async function POST(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { on?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  await cache.set(KEY, body.on === true, TTL);
  return NextResponse.json({ on: body.on === true });
}
