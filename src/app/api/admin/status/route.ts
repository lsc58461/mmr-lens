import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import { cache } from "@/lib/cache";
import { ALGO_VERSION } from "@/lib/mmr/estimate";
import { getRecentSearches } from "@/lib/recent";

export const dynamic = "force-dynamic";

// 잡 키 "deepjob:kr:이름#태그" → { region, name }
function parseJobKey(key: string): { region: string; name: string } {
  const parts = key.split(":");
  return { region: parts[1] ?? "?", name: parts.slice(2).join(":") };
}

export async function GET(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const [lock, queue, recent] = await Promise.all([
    cache.get<{ key: string; at: number }>("deep-runner-lock"),
    cache.get<{ key: string; at: number }[]>("deep-queue:list"),
    getRecentSearches(),
  ]);

  let running: {
    region: string;
    name: string;
    progress: number;
    state: string;
    updatedAgoSec: number;
  } | null = null;
  if (lock && now - lock.at < 5 * 60_000) {
    const job = await cache.get<{
      state: string;
      progress: number;
      updatedAt: number;
    }>(lock.key);
    if (job) {
      running = {
        ...parseJobKey(lock.key),
        progress: job.progress,
        state: job.state,
        updatedAgoSec: Math.round((now - job.updatedAt) / 1000),
      };
    }
  }

  const waiting = (queue ?? [])
    .filter((e) => now - e.at < 60_000)
    .map((e, i) => ({
      position: i + 1,
      ...parseJobKey(e.key),
      lastSeenAgoSec: Math.round((now - e.at) / 1000),
    }));

  // 기록된 소환사 전체(최근 검색 기준) + 분석 캐시 보유·스테일 상태.
  // 스테일 판정은 저장 데이터 간 비교(정밀 vs 빠른의 매치 기준, 알고리즘 버전)로,
  // 라이엇 API 호출 없이 계산한다 — 실제 새 경기 여부까지는 알 수 없음.
  interface StoredMeta {
    latestMatchId?: string | null;
    algoVersion?: number;
    analyzedAt?: number;
  }
  const [quickEntries, deepEntries] = await Promise.all([
    cache.entries<StoredMeta>("quick:"),
    cache.entries<StoredMeta>("deep:"),
  ]);
  const quickMap = new Map(
    quickEntries.map((e) => [e.key.slice("quick:".length), e.value]),
  );
  const deepMap = new Map(
    deepEntries.map((e) => [e.key.slice("deep:".length), e.value]),
  );

  const summoners = recent.map((r) => {
    const id = `${r.region}:${r.gameName.toLowerCase()}#${r.tagLine.toLowerCase()}`;
    const quick = quickMap.get(id);
    const deep = deepMap.get(id);
    const FRESH_AGE_MS = 24 * 60 * 60_000;
    const isCurrent = (m: StoredMeta) =>
      (m.algoVersion ?? 0) === ALGO_VERSION &&
      now - (m.analyzedAt ?? 0) <= FRESH_AGE_MS;
    let analysis: "deep" | "deep-stale" | "quick" | "quick-stale" | "none";
    if (deep) {
      // 정밀이 빠른보다 나중에 분석됐으면 정밀이 최신 — 매치 ID가 달라도 스테일 아님.
      // 빠른이 더 나중이고 매치 기준까지 다를 때만 정밀이 뒤처진 것으로 본다.
      const behindQuick =
        !!quick &&
        (quick.analyzedAt ?? 0) > (deep.analyzedAt ?? 0) &&
        quick.latestMatchId !== deep.latestMatchId;
      analysis = isCurrent(deep) && !behindQuick ? "deep" : "deep-stale";
    } else if (quick) {
      analysis = isCurrent(quick) ? "quick" : "quick-stale";
    } else {
      analysis = "none";
    }
    return {
      region: r.region,
      name: `${r.gameName}#${r.tagLine}`,
      currentLabel: r.currentLabel,
      estimatedLabel: r.estimatedLabel,
      searchedAt: r.searchedAt,
      analysis,
    };
  });

  return NextResponse.json({
    running,
    waiting,
    summoners,
    serverTime: now,
  });
}
