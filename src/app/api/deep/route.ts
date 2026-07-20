import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import {
  getDeepJob,
  getFreshDeepResult,
  getLatestMatchId,
  isJobStale,
  markDeepJobRunning,
  runDeepAnalysis,
} from "@/lib/mmr/deep-jobs";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";
// 정밀 분석은 개발 키 기준 3~4분 — after() 백그라운드 작업도 이 제한을 따른다
export const maxDuration = 300;

export async function GET(req: NextRequest) {
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
    if (await getFreshDeepResult(platform, gameName, tagLine, latestMatchId)) {
      return NextResponse.json({ state: "done", progress: 1 });
    }

    const job = await getDeepJob(platform, gameName, tagLine);
    if (job && !isJobStale(job)) {
      if (job.state === "running") {
        return NextResponse.json({ state: "running", progress: job.progress });
      }
      if (job.state === "error") {
        return NextResponse.json({ state: "error", progress: 0 });
      }
      // done인데 신선한 결과가 없으면 새 경기가 생긴 것 — 아래로 내려가 재시작
    }

    // 새 잡 시작 — 응답을 먼저 보내고 after()로 백그라운드에서 분석
    await markDeepJobRunning(platform, gameName, tagLine);
    after(() => runDeepAnalysis(platform, gameName, tagLine));
    return NextResponse.json({ state: "running", progress: 0 });
  } catch {
    return NextResponse.json({ state: "error", progress: 0 });
  }
}
