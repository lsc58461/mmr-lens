// 내전 팀 밸런싱 — 웹(/api/team/resolve)과 디스코드 봇이 공유하는 로직.

import "server-only";
import { getStoredResult } from "./deep-jobs";
import { pointsToRank, rankToPoints } from "./rank";
import { getAccountByRiotId, getLeagueEntries } from "@/lib/riot/client";
import { RiotApiError, type PlatformRegion } from "@/lib/riot/types";

export interface ResolvedPlayer {
  input: string;
  name: string; // 캐노니컬 게임명#태그
  points: number;
  label: string; // "에메랄드 2 · 30LP"
  tier: string;
  source: "analysis" | "rank" | "unranked";
  error?: string;
}

const UNRANKED_POINTS = 800; // 실버 4 상당 기본값

/**
 * 각 플레이어의 실력 점수를 해석한다.
 * 우선순위: 저장된 추정 MMR(정밀>빠른, 신선도 무관) → 현재 랭크 → 언랭 기본값
 */
export async function resolvePlayers(
  platform: PlatformRegion,
  names: string[],
): Promise<ResolvedPlayer[]> {
  return Promise.all(
    names.map(async (input): Promise<ResolvedPlayer> => {
      const hash = input.lastIndexOf("#");
      if (hash <= 0 || hash === input.length - 1) {
        return {
          input,
          name: input,
          points: 0,
          label: "-",
          tier: "IRON",
          source: "unranked",
          error: "게임명#태그 형식이 아니에요",
        };
      }
      const gameName = input.slice(0, hash);
      const tagLine = input.slice(hash + 1);
      try {
        const stored =
          (await getStoredResult("deep", platform, gameName, tagLine)) ??
          (await getStoredResult("quick", platform, gameName, tagLine));
        if (stored?.estimatedPoints != null) {
          const pts = Math.round(stored.estimatedPoints);
          const rank = pointsToRank(pts);
          return {
            input,
            name: `${stored.account.gameName}#${stored.account.tagLine}`,
            points: pts,
            label: rank.label,
            tier: rank.tier,
            source: "analysis",
          };
        }
        const account = await getAccountByRiotId(platform, gameName, tagLine);
        const entries = await getLeagueEntries(platform, account.puuid);
        const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
        if (solo) {
          const pts = rankToPoints(solo.tier, solo.rank, solo.leaguePoints);
          const rank = pointsToRank(pts);
          return {
            input,
            name: `${account.gameName}#${account.tagLine}`,
            points: pts,
            label: rank.label,
            tier: rank.tier,
            source: "rank",
          };
        }
        return {
          input,
          name: `${account.gameName}#${account.tagLine}`,
          points: UNRANKED_POINTS,
          label: "언랭크 (기본값)",
          tier: "SILVER",
          source: "unranked",
        };
      } catch (e) {
        return {
          input,
          name: input,
          points: 0,
          label: "-",
          tier: "IRON",
          source: "unranked",
          error:
            e instanceof RiotApiError && e.status === 404
              ? "계정을 찾을 수 없어요"
              : "조회에 실패했어요",
        };
      }
    }),
  );
}

/** 전력차가 가장 작은 팀 분할 (짝수 인원 전제) */
export function bestPartition(players: ResolvedPlayer[]): {
  a: ResolvedPlayer[];
  b: ResolvedPlayer[];
  diff: number;
} | null {
  const n = players.length;
  if (n < 2 || n % 2 !== 0) return null;
  const half = n / 2;
  let best: { a: number[]; diff: number } | null = null;

  const combo = (start: number, picked: number[]) => {
    if (picked.length === half) {
      // 첫 플레이어 고정으로 대칭 중복 제거
      if (!picked.includes(0)) return;
      const sumA = picked.reduce((s, i) => s + players[i].points, 0);
      const sumB = players.reduce(
        (s, p, i) => (picked.includes(i) ? s : s + p.points),
        0,
      );
      const diff = Math.abs(sumA - sumB);
      if (!best || diff < best.diff) best = { a: picked, diff };
      return;
    }
    for (let i = start; i < n; i++) combo(i + 1, [...picked, i]);
  };
  combo(0, []);
  if (!best) return null;

  const picked = (best as { a: number[]; diff: number }).a;
  return {
    a: picked.map((i) => players[i]),
    b: players.filter((_, i) => !picked.includes(i)),
    diff: (best as { a: number[]; diff: number }).diff,
  };
}
