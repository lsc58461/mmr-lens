import { NextResponse, type NextRequest } from "next/server";
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

// 새벽(트래픽 없는 시간) 크론 — 기록된 소환사 중 스테일한 결과를
// 실제 검색 흐름과 동일하게(빠른 추정 → 이어서 정밀 분석) 미리 갱신한다.
// vercel.json crons: 18:00/19:00 UTC = 새벽 3시/4시 KST
const TIME_BUDGET_MS = 240_000; // maxDuration(300s)에서 여유를 둔 작업 예산
const DEEP_START_DEADLINE_MS = 45_000; // 이 시점 이후엔 정밀을 새로 시작하지 않음(시간 초과 방지)
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
  const elapsed = () => Date.now() - started;
  const recent = await getRecentSearches(); // 최근 검색 순

  const quickRefreshed: string[] = [];
  let deepCompleted = 0;
  let deepBlocked = false; // 러너 락이 다른 분석에 잡혀 있으면 이번 실행에선 정밀 생략
  let skipped = 0;
  let failed = 0;

  for (const r of recent) {
    if (elapsed() > TIME_BUDGET_MS || quickRefreshed.length >= limit) break;
    const name = `${r.gameName}#${r.tagLine}`;
    try {
      const latest = await getLatestMatchId(r.region, r.gameName, r.tagLine);
      if (await getFreshDeepResult(r.region, r.gameName, r.tagLine, latest)) {
        skipped++;
        continue;
      }

      // 1) 실제 흐름처럼 빠른 추정 먼저
      const quickFresh = await getFreshQuickResult(
        r.region,
        r.gameName,
        r.tagLine,
        latest,
      );
      if (!quickFresh) {
        await runQuickAnalysis(r.region, r.gameName, r.tagLine);
        quickRefreshed.push(name);
      }

      // 2) 이어서 정밀 분석 — 완료까지 기다린 뒤 다음 소환사로 (러너 락 존중)
      if (!deepBlocked && elapsed() < DEEP_START_DEADLINE_MS) {
        let deepRun: Promise<void> | null = null;
        await ensureQueuedAndSchedule(r.region, r.gameName, r.tagLine, (p, g, t) => {
          deepRun = runDeepAnalysis(p, g, t);
        });
        if (deepRun) {
          await deepRun;
          deepCompleted++;
        } else {
          deepBlocked = true;
        }
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    quickRefreshed,
    deepCompleted,
    deepBlocked,
    skipped,
    failed,
    tookMs: elapsed(),
  });
}
