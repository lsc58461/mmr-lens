import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import {
  ensureQueuedAndSchedule,
  getFreshDeepResult,
  getFreshQuickResult,
  getLatestMatchId,
  runDeepAnalysis,
  runQuickAnalysis,
} from "@/lib/mmr/deep-jobs";
import { getRecentSearches } from "@/lib/recent";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 새벽(트래픽 없는 시간) 크론이 호출 — 기록된 소환사 중 스테일한 결과를
// 미리 재분석해 두어 낮 시간 방문자가 항상 신선한 결과를 즉시 보게 한다.
// vercel.json crons: 18:00/19:00 UTC = 새벽 3시/4시 KST
const TIME_BUDGET_MS = 240_000; // maxDuration(300s)에서 여유를 둔 작업 예산
const MAX_REFRESH = 10;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? MAX_REFRESH),
    MAX_REFRESH,
  );

  const started = Date.now();
  const recent = await getRecentSearches(); // 최근 검색 순

  // mode=deep: 가장 최근 검색된 "정밀 스테일" 소환사 1명의 정밀 분석을 실행
  // (정밀 1건 ≈ 4분이라 크론 1회 예산 전체를 사용 — 4시 크론이 담당)
  if (req.nextUrl.searchParams.get("mode") === "deep") {
    for (const r of recent) {
      try {
        const latest = await getLatestMatchId(r.region, r.gameName, r.tagLine);
        if (await getFreshDeepResult(r.region, r.gameName, r.tagLine, latest)) {
          continue;
        }
        const sched = await ensureQueuedAndSchedule(
          r.region,
          r.gameName,
          r.tagLine,
          (p, g, t) => after(() => runDeepAnalysis(p, g, t)),
        );
        return NextResponse.json({
          deepTarget: `${r.gameName}#${r.tagLine}`,
          started: sched.selfStarted,
          tookMs: Date.now() - started,
        });
      } catch {
        continue;
      }
    }
    return NextResponse.json({ deepTarget: null, tookMs: Date.now() - started });
  }
  const refreshed: string[] = [];
  let skipped = 0;
  let failed = 0;

  for (const r of recent) {
    if (Date.now() - started > TIME_BUDGET_MS || refreshed.length >= limit) {
      break;
    }
    const name = `${r.gameName}#${r.tagLine}`;
    try {
      const latest = await getLatestMatchId(r.region, r.gameName, r.tagLine);
      const fresh =
        (await getFreshDeepResult(r.region, r.gameName, r.tagLine, latest)) ??
        (await getFreshQuickResult(r.region, r.gameName, r.tagLine, latest));
      if (fresh) {
        skipped++;
        continue;
      }
      await runQuickAnalysis(r.region, r.gameName, r.tagLine);
      refreshed.push(name);
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    refreshed,
    skipped,
    failed,
    tookMs: Date.now() - started,
  });
}
