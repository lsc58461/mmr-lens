import { NextResponse, type NextRequest } from "next/server";

// 점검 모드 미들웨어 — 어드민이 /admin에서 토글하면 모든 페이지가
// /maintenance로 rewrite된다. 플래그는 /api/maintenance에서 조회하고
// 엣지 인스턴스별로 10초 캐시해 요청마다 DB를 두드리지 않는다.
// /admin·/api는 매처에서 제외 — 점검 중에도 끌 수 있어야 한다.

let cached: { on: boolean; at: number } | null = null;
const CACHE_MS = 10_000;

async function isMaintenanceOn(origin: string): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.on;
  try {
    const res = await fetch(`${origin}/api/maintenance`, {
      signal: AbortSignal.timeout(3_000),
    });
    const data: { active: boolean } = await res.json();
    cached = { on: data.active === true, at: Date.now() };
  } catch {
    // 조회 실패 시 서비스를 막지 않는다
    cached = { on: false, at: Date.now() };
  }
  return cached.on;
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/maintenance") return NextResponse.next();
  if (await isMaintenanceOn(req.nextUrl.origin)) {
    return NextResponse.rewrite(new URL("/maintenance", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // 페이지 요청만 대상 — api/admin/정적 파일 제외
  matcher: [
    "/((?!api|admin|_next|favicon|icon|opengraph-image|robots|sitemap|ranked-emblems|.*\\..*).*)",
  ],
};
