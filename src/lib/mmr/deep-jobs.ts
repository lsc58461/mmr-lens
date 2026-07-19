// 정밀 분석(20경기 × 전원) 백그라운드 잡 관리.
// 페이지는 빠른 추정을 먼저 보여주고, 클라이언트가 /api/deep을 폴링하면
// 여기서 잡을 시작해 완료 시 결과를 캐시에 넣는다. 완료 후 페이지 새로고침이
// 캐시를 읽어 정밀 결과로 갱신된다.
//
// 주의: 잡 상태가 서버 메모리에 있으므로 long-running 서버(npm start, Railway 등)
// 전제다. 서버리스(Vercel)에서는 응답 후 실행이 동결돼 동작하지 않는다.

import "server-only";
import { cache } from "@/lib/cache";
import type { PlatformRegion } from "@/lib/riot/types";
import { DEEP_DEPTH, estimateMmr, type MmrEstimate } from "./estimate";

export interface DeepJob {
  state: "running" | "done" | "error";
  progress: number; // 0~1
}

const globalForJobs = globalThis as unknown as {
  __deepJobs?: Map<string, DeepJob>;
};
const jobs = globalForJobs.__deepJobs ?? (globalForJobs.__deepJobs = new Map());

export function deepCacheKey(
  platform: string,
  gameName: string,
  tagLine: string,
): string {
  return `deep:${platform}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
}

export function getDeepJob(key: string): DeepJob | null {
  return jobs.get(key) ?? null;
}

export function getDeepResult(key: string): Promise<MmrEstimate | null> {
  return cache.get<MmrEstimate>(key);
}

/** 이미 실행 중이면 무시하고, 아니면 정밀 분석을 백그라운드로 시작 */
export function startDeepJob(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): void {
  const key = deepCacheKey(platform, gameName, tagLine);
  if (jobs.get(key)?.state === "running") return;

  const job: DeepJob = { state: "running", progress: 0 };
  jobs.set(key, job);

  void estimateMmr(platform, gameName, tagLine, DEEP_DEPTH, (done, total) => {
    job.progress = total ? done / total : 0;
  })
    .then(async (result) => {
      await cache.set(key, result, 60 * 30);
      job.state = "done";
    })
    .catch(() => {
      job.state = "error";
    });
}
