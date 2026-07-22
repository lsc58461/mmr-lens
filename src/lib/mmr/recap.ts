// 시즌 결산 — 축적된 매치 데이터(matches 테이블) + 랭크 히스토리 기반.
// 시즌 전체 판수만 API로 세고(캐시 24h), 상세 통계는 저장된 경기에서 계산한다.

import "server-only";
import { cached } from "@/lib/cache";
import { pointsToRank, rankToPoints, type RankLabel } from "./rank";
import {
  getAccountByRiotId,
  getLeagueHistory,
  riotCountRankedMatches,
} from "@/lib/riot/client";
import { listMatchesForPuuid } from "@/lib/store";
import { riotKeyFp } from "@/lib/riot/client";
import type { PlatformRegion } from "@/lib/riot/types";

export interface ChampStat {
  championName: string;
  games: number;
  wins: number;
}

export interface Recap {
  name: string;
  totalRanked: number; // 시즌 랭크 판수 (500이면 500+)
  totalCapped: boolean;
  analyzed: number; // 상세 통계에 사용된 저장 경기 수
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  topChamps: ChampStat[];
  peakRank: RankLabel | null; // 관측된 최고 랭크
  currentRank: RankLabel | null;
}

export async function buildRecap(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<Recap> {
  const account = await getAccountByRiotId(platform, gameName, tagLine);

  const { total, capped } = await cached(
    `recap-count:${platform}:${account.puuid}`,
    60 * 60 * 24,
    () => riotCountRankedMatches(platform, account.puuid),
  );

  const matches = (await listMatchesForPuuid(riotKeyFp(), account.puuid)).filter(
    (m) => m.gameDuration >= 300,
  );
  let wins = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  const champs = new Map<string, ChampStat>();
  for (const m of matches) {
    const self = m.participants.find((p) => p.puuid === account.puuid);
    if (!self) continue;
    if (self.win) wins++;
    kills += self.kills;
    deaths += self.deaths;
    assists += self.assists;
    const c = champs.get(self.championName) ?? {
      championName: self.championName,
      games: 0,
      wins: 0,
    };
    c.games++;
    if (self.win) c.wins++;
    champs.set(self.championName, c);
  }
  const topChamps = [...champs.values()]
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  // 랭크 히스토리에서 최고점·현재
  const snaps = await getLeagueHistory(platform, account.puuid).catch(() => []);
  let peakPts: number | null = null;
  let currentPts: number | null = null;
  for (const s of snaps) {
    if (s.solo_tier === null || s.solo_rank === null || s.solo_lp === null)
      continue;
    const pts = rankToPoints(s.solo_tier, s.solo_rank, s.solo_lp);
    if (peakPts === null || pts > peakPts) peakPts = pts;
    currentPts = pts; // ASC 정렬이라 마지막 값이 최신
  }

  return {
    name: `${account.gameName}#${account.tagLine}`,
    totalRanked: total,
    totalCapped: capped,
    analyzed: matches.length,
    wins,
    losses: matches.length - wins,
    kills,
    deaths,
    assists,
    topChamps,
    peakRank: peakPts !== null ? pointsToRank(peakPts) : null,
    currentRank: currentPts !== null ? pointsToRank(currentPts) : null,
  };
}
