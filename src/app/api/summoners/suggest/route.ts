import { NextResponse, type NextRequest } from "next/server";
import { searchRecentSummoners } from "@/lib/store";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";

// 소환사 입력 자동완성 — 기록된 검색 기반 (공개 데이터, 최근 검색 페이지와 동일 범위)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get("region") ?? "kr";
  if (!(region in PLATFORM_LABELS)) {
    return NextResponse.json({ items: [] });
  }
  const q = (sp.get("q") ?? "").trim().normalize("NFKC").slice(0, 40);
  try {
    const items = await searchRecentSummoners(region as PlatformRegion, q);
    return NextResponse.json(
      {
        items: items.map((s) => ({
          name: s.game_name,
          tag: s.tag_line,
          label: s.current_label,
          tier: s.current_tier,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
