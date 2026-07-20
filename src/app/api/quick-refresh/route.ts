import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import {
  getFreshDeepResult,
  getFreshQuickResult,
  getLatestMatchId,
  runQuickAnalysis,
} from "@/lib/mmr/deep-jobs";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// stale-while-revalidate 갱신 엔드포인트.
// 이전 분석을 먼저 보여준 페이지가 폴링하면, 백그라운드로 빠른 재분석을 돌리고
// 신선한 결과가 준비되면 fresh=true를 반환한다 (클라이언트가 새로고침).
export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get("region") ?? "";
  const gameName = sp.get("gameName") ?? "";
  const tagLine = sp.get("tagLine") ?? "";
  if (!(region in PLATFORM_LABELS) || !gameName || !tagLine) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const platform = region as PlatformRegion;

  try {
    const latestMatchId = await getLatestMatchId(platform, gameName, tagLine);
    const fresh =
      (await getFreshDeepResult(platform, gameName, tagLine, latestMatchId)) !==
        null ||
      (await getFreshQuickResult(platform, gameName, tagLine, latestMatchId)) !==
        null;
    if (fresh) return NextResponse.json({ fresh: true });

    // 진행 중이면 runQuickAnalysis 내부의 in-flight 공유가 중복 실행을 막는다
    after(() =>
      runQuickAnalysis(platform, gameName, tagLine).catch(() => {}),
    );
    return NextResponse.json({ fresh: false });
  } catch {
    return NextResponse.json({ fresh: false, error: true }, { status: 502 });
  }
}
