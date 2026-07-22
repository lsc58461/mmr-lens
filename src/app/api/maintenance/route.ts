import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import { cache } from "@/lib/cache";
import {
  MAINTENANCE_KEY,
  getMaintenanceInfo,
  isMaintenanceActive,
  type MaintenanceInfo,
} from "@/lib/maintenance";

export const dynamic = "force-dynamic";

const TTL = 60 * 60 * 24 * 365; // 끄기 전까지 유지

export async function GET() {
  const info = await getMaintenanceInfo();
  return NextResponse.json(
    {
      active: isMaintenanceActive(info),
      on: info?.on === true,
      reason: info?.reason ?? null,
      startsAt: info?.startsAt ?? null,
      endsAt: info?.endsAt ?? null,
    },
    { headers: { "Cache-Control": "public, max-age=10" } },
  );
}

// 어드민 전용 설정
export async function POST(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: MaintenanceInfo;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const info: MaintenanceInfo = {
    on: body.on === true,
    reason: body.reason?.trim() || null,
    startsAt: body.startsAt || null,
    endsAt: body.endsAt || null,
  };
  await cache.set(MAINTENANCE_KEY, info, TTL);
  return NextResponse.json({ ...info, active: isMaintenanceActive(info) });
}
