import { NextResponse, type NextRequest } from "next/server";
import {
  deepCacheKey,
  getDeepJob,
  getDeepResult,
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

  const key = deepCacheKey(region, gameName, tagLine);
  if (await getDeepResult(key)) {
    return NextResponse.json({ state: "done", progress: 1 });
  }

  const job = getDeepJob(key);
  if (!job || job.state === "done") {
    // done인데 캐시가 없으면 만료된 것 — 새로 시작
    startDeepJob(region as PlatformRegion, gameName, tagLine);
    return NextResponse.json({ state: "running", progress: 0 });
  }
  return NextResponse.json({ state: job.state, progress: job.progress });
}
