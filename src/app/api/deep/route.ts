import { NextResponse, type NextRequest } from "next/server";
import {
  getDeepJob,
  deepCacheKey,
  getFreshDeepResult,
  getLatestMatchId,
  startDeepJob,
} from "@/lib/mmr/deep-jobs";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";

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
  } catch {
    return NextResponse.json({ state: "error", progress: 0 });
  }

  const job = getDeepJob(deepCacheKey(platform, gameName, tagLine));
  if (!job || job.state === "done") {
    // done인데 신선한 결과가 없으면 새 경기가 생긴 것 — 다시 분석
    startDeepJob(platform, gameName, tagLine);
    return NextResponse.json({ state: "running", progress: 0 });
  }
  return NextResponse.json({ state: job.state, progress: job.progress });
}
