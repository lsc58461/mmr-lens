import { NextResponse, type NextRequest } from "next/server";
import { findRenamedTo } from "@/lib/store";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";

// 닉변 이력 조회 — 미들웨어가 옛 이름 접근을 새 이름으로 리다이렉트할 때 사용
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get("region") ?? "";
  const riotId = (sp.get("riotId") ?? "").normalize("NFKC");
  const hash = riotId.lastIndexOf("#");
  if (!(region in PLATFORM_LABELS) || hash <= 0) {
    return NextResponse.json({ renamed: null });
  }
  try {
    const to = await findRenamedTo(
      region as PlatformRegion,
      riotId.slice(0, hash),
      riotId.slice(hash + 1),
    );
    return NextResponse.json({
      renamed: to ? `${to.gameName}#${to.tagLine}` : null,
    });
  } catch {
    return NextResponse.json({ renamed: null });
  }
}
