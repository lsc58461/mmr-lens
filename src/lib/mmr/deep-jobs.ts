// 분석 결과 저장/재사용 + 정밀 분석 백그라운드 잡 관리.
//
// 저장된 결과(quick/deep)는 TTL이 아니라 "새 경기가 생겼는지"로 무효화한다:
// 검색 시 최신 매치 ID 하나만 비교해서 같으면 이전 분석을 그대로 재사용하고,
// 다르면(새 게임을 돌렸으면) 다시 분석한다. TTL은 안전망(24시간)으로만 둔다.
//
// 주의: 잡 상태가 서버 메모리에 있으므로 long-running 서버(npm start, Railway 등)
// 전제다. 서버리스(Vercel)에서는 응답 후 실행이 동결돼 동작하지 않는다.

import "server-only";
import { cache } from "@/lib/cache";
import { getAccountByRiotId, getRankedMatchIds } from "@/lib/riot/client";
import type { PlatformRegion } from "@/lib/riot/types";
import {
  DEEP_DEPTH,
  QUICK_DEPTH,
  estimateMmr,
  fetchCountFor,
  type MmrEstimate,
} from "./estimate";

const RESULT_TTL = 60 * 60 * 24; // 안전망 TTL — 신선도 판단은 latestMatchId 비교가 우선

export interface DeepJob {
  state: "running" | "done" | "error";
  progress: number; // 0~1
}

const globalForJobs = globalThis as unknown as {
  __deepJobs?: Map<string, DeepJob>;
  __quickInflight?: Map<string, Promise<MmrEstimate>>;
};
const jobs = globalForJobs.__deepJobs ?? (globalForJobs.__deepJobs = new Map());
// 같은 소환사를 여러 요청이 동시에 검색해도 분석은 1번만 돌도록 진행 중 Promise를 공유
const quickInflight =
  globalForJobs.__quickInflight ?? (globalForJobs.__quickInflight = new Map());

function resultKey(
  kind: "quick" | "deep",
  platform: string,
  gameName: string,
  tagLine: string,
): string {
  return `${kind}:${platform}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
}

export function deepCacheKey(
  platform: string,
  gameName: string,
  tagLine: string,
): string {
  return resultKey("deep", platform, gameName, tagLine);
}

export function getDeepJob(key: string): DeepJob | null {
  return jobs.get(key) ?? null;
}

/** 현재 최신 매치 ID (account/matchids 캐시를 타므로 저렴) */
export async function getLatestMatchId(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<string | null> {
  const account = await getAccountByRiotId(platform, gameName, tagLine);
  const ids = await getRankedMatchIds(
    platform,
    account.puuid,
    fetchCountFor(QUICK_DEPTH),
  );
  return ids[0] ?? null;
}

/** 저장된 결과가 있고 그 이후 새 경기가 없으면 반환, 아니면 null */
async function getFreshResult(
  kind: "quick" | "deep",
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  latestMatchId: string | null,
): Promise<MmrEstimate | null> {
  const stored = await cache.get<MmrEstimate>(
    resultKey(kind, platform, gameName, tagLine),
  );
  if (!stored || stored.latestMatchId !== latestMatchId) return null;
  return stored;
}

export function getFreshDeepResult(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  latestMatchId: string | null,
): Promise<MmrEstimate | null> {
  return getFreshResult("deep", platform, gameName, tagLine, latestMatchId);
}

export function getFreshQuickResult(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  latestMatchId: string | null,
): Promise<MmrEstimate | null> {
  return getFreshResult("quick", platform, gameName, tagLine, latestMatchId);
}

export async function saveQuickResult(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  result: MmrEstimate,
): Promise<void> {
  await cache.set(
    resultKey("quick", platform, gameName, tagLine),
    result,
    RESULT_TTL,
  );
}

/**
 * 빠른 추정 실행 + 저장. 동일 소환사에 대한 동시 요청은 진행 중인
 * 분석 Promise를 공유해 API 호출이 중복되지 않는다 (thundering herd 방지).
 */
export function runQuickAnalysis(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<MmrEstimate> {
  const key = resultKey("quick", platform, gameName, tagLine);
  const existing = quickInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const result = await estimateMmr(platform, gameName, tagLine, QUICK_DEPTH);
    await saveQuickResult(platform, gameName, tagLine, result);
    return result;
  })().finally(() => quickInflight.delete(key));

  quickInflight.set(key, promise);
  return promise;
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
      await cache.set(key, result, RESULT_TTL);
      job.state = "done";
    })
    .catch(() => {
      job.state = "error";
    });
}
