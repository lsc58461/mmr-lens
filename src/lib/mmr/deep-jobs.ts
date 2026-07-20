// 분석 결과 저장/재사용 + 정밀 분석 백그라운드 잡 관리.
//
// 저장된 결과(quick/deep)는 TTL이 아니라 "새 경기가 생겼는지"로 무효화한다:
// 검색 시 최신 매치 ID 하나만 비교해서 같으면 이전 분석을 그대로 재사용하고,
// 다르면(새 게임을 돌렸으면) 다시 분석한다. TTL은 안전망(24시간)으로만 둔다.
//
// 잡 상태는 캐시(DATABASE_URL이 있으면 Postgres)에 저장한다 — Vercel처럼
// 인스턴스가 여러 개인 환경에서도 어느 인스턴스든 진행 상황을 볼 수 있다.
// 백그라운드 실행 자체는 라우트 핸들러에서 next/server의 after()로 시작한다.

import "server-only";
import { cache } from "@/lib/cache";
import { getAccountByRiotId, getRankedMatchIds } from "@/lib/riot/client";
import type { PlatformRegion } from "@/lib/riot/types";
import {
  ALGO_VERSION,
  DEEP_DEPTH,
  QUICK_DEPTH,
  estimateMmr,
  fetchCountFor,
  type MmrEstimate,
} from "./estimate";

const RESULT_TTL = 60 * 60 * 24; // 안전망 TTL — 신선도 판단은 latestMatchId 비교가 우선
const JOB_TTL = 60 * 15;
const JOB_STALE_MS = 5 * 60_000; // 이 시간 동안 진행이 없으면 죽은 잡으로 간주

export interface DeepJob {
  state: "running" | "done" | "error";
  progress: number; // 0~1
  updatedAt: number;
}

const globalForJobs = globalThis as unknown as {
  __quickInflight?: Map<string, Promise<MmrEstimate>>;
};
// 같은 소환사를 여러 요청이 동시에 검색해도 분석은 1번만 돌도록 진행 중 Promise를 공유
// (인스턴스 단위 최적화 — 인스턴스가 갈리면 각자 돌 수 있지만 결과는 동일)
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

function jobKey(platform: string, gameName: string, tagLine: string): string {
  return `deepjob:${platform}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
}

/** 현재 최신 매치 ID (account/matchids 캐시를 타므로 저렴) */
export async function getLatestMatchId(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  bypassCache = false,
): Promise<string | null> {
  const account = await getAccountByRiotId(platform, gameName, tagLine);
  const ids = await getRankedMatchIds(
    platform,
    account.puuid,
    fetchCountFor(QUICK_DEPTH),
    bypassCache,
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
  if (
    !stored ||
    stored.latestMatchId !== latestMatchId ||
    // 구버전 알고리즘으로 계산된 결과는 재분석
    (stored.algoVersion ?? 0) !== ALGO_VERSION
  ) {
    return null;
  }
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
    await cache.set(key, result, RESULT_TTL);
    return result;
  })().finally(() => quickInflight.delete(key));

  quickInflight.set(key, promise);
  return promise;
}

export function getDeepJob(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<DeepJob | null> {
  return cache.get<DeepJob>(jobKey(platform, gameName, tagLine));
}

export function isJobStale(job: DeepJob): boolean {
  return Date.now() - job.updatedAt > JOB_STALE_MS;
}

/** 잡을 running으로 마킹 — after()로 runDeepAnalysis를 시작하기 직전에 호출 */
export async function markDeepJobRunning(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<void> {
  await cache.set<DeepJob>(
    jobKey(platform, gameName, tagLine),
    { state: "running", progress: 0, updatedAt: Date.now() },
    JOB_TTL,
  );
}

/** 정밀 분석 본체. 진행률을 캐시에 기록하며 완료 시 결과를 저장한다. */
export async function runDeepAnalysis(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<void> {
  const jk = jobKey(platform, gameName, tagLine);
  let lastWritten = 0;
  try {
    const result = await estimateMmr(
      platform,
      gameName,
      tagLine,
      DEEP_DEPTH,
      (done, total) => {
        const p = total ? done / total : 0;
        // 진행률은 5% 단위로만 기록해 DB 쓰기를 아낀다
        if (p - lastWritten >= 0.05) {
          lastWritten = p;
          void cache.set<DeepJob>(
            jk,
            { state: "running", progress: p, updatedAt: Date.now() },
            JOB_TTL,
          );
        }
      },
    );
    await cache.set(
      resultKey("deep", platform, gameName, tagLine),
      result,
      RESULT_TTL,
    );
    await cache.set<DeepJob>(
      jk,
      { state: "done", progress: 1, updatedAt: Date.now() },
      JOB_TTL,
    );
  } catch {
    await cache
      .set<DeepJob>(
        jk,
        { state: "error", progress: 0, updatedAt: Date.now() },
        JOB_TTL,
      )
      .catch(() => {});
  }
}
