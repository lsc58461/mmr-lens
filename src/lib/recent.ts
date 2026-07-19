// 최근 검색 기록. 캐시 스토어의 "recent:list" 키에 배열로 보관한다.
// (Supabase 연결 시 영구 보존, 인메모리면 서버 재시작 시 초기화)

import "server-only";
import { cache } from "@/lib/cache";
import type { PlatformRegion } from "@/lib/riot/types";

export interface RecentEntry {
  region: PlatformRegion;
  gameName: string;
  tagLine: string;
  currentLabel: string | null; // "챌린저 1677LP" 등, 언랭이면 null
  currentTier: string | null;
  estimatedLabel: string | null;
  estimatedTier: string | null;
  estimatedPoints: number | null;
  searchedAt: number;
}

const KEY = "recent:list";
const MAX_ENTRIES = 50;
const TTL_SECONDS = 60 * 60 * 24 * 90;

export async function getRecentSearches(): Promise<RecentEntry[]> {
  return (await cache.get<RecentEntry[]>(KEY)) ?? [];
}

/** 같은 소환사는 최신 기록으로 갱신하고 맨 앞으로 올린다 */
export async function recordSearch(entry: Omit<RecentEntry, "searchedAt">) {
  try {
    const list = await getRecentSearches();
    const dedup = list.filter(
      (e) =>
        !(
          e.region === entry.region &&
          e.gameName.toLowerCase() === entry.gameName.toLowerCase() &&
          e.tagLine.toLowerCase() === entry.tagLine.toLowerCase()
        ),
    );
    dedup.unshift({ ...entry, searchedAt: Date.now() });
    await cache.set(KEY, dedup.slice(0, MAX_ENTRIES), TTL_SECONDS);
  } catch {
    // 기록 실패는 검색 결과 표시에 영향을 주지 않는다
  }
}
