// MMR 추정 파이프라인.
// 1) 최근 솔로랭크 매치를 가져오고
// 2) 각 매치에서 팀별로 고르게 뽑은 참가자들의 "현재 랭크"를 조회해 로비 평균을 구한 뒤
// 3) 최근 경기에 가중치를 두고 승률 보정을 더해 추정 MMR을 계산한다.
//
// 개발용 API 키(2분당 100회) 안에서 동작하도록 매치 수와 참가자 샘플 수를 제한한다.

import "server-only";
import {
  getAccountByRiotId,
  getLeagueEntries,
  getMatch,
  getRankedMatchIds,
} from "@/lib/riot/client";
import type { LeagueEntry, MatchInfo, PlatformRegion } from "@/lib/riot/types";
import { pointsToRank, rankToPoints, type RankLabel } from "./rank";

const MATCH_COUNT = 8; // 분석할 최근 솔로랭크 경기 수
const SAMPLES_PER_TEAM = 3; // 매치당 팀별 랭크 조회 인원 (3+3 = 매치당 6회 호출)
const RECENCY_DECAY = 0.85; // 최신 경기 가중치 감쇠율
const WINRATE_ADJUST = 150; // 승률 50% 대비 최대 보정 포인트(±75)

export interface MatchSample {
  matchId: string;
  gameCreation: number;
  win: boolean;
  championName: string;
  kda: string;
  lobbyPoints: number | null; // 로비 평균 MMR 포인트 (표본 없으면 null)
  sampleSize: number;
}

export interface MmrEstimate {
  account: { gameName: string; tagLine: string };
  soloEntry: LeagueEntry | null;
  currentPoints: number | null;
  currentRank: RankLabel | null;
  estimatedPoints: number | null;
  estimatedRank: RankLabel | null;
  gap: number | null; // 추정 - 현재 (양수면 티어보다 실력이 높다는 뜻)
  recentWinrate: number | null;
  matches: MatchSample[];
  sampledPlayers: number;
  confidence: "high" | "medium" | "low";
}

function soloQueueEntry(entries: LeagueEntry[]): LeagueEntry | null {
  return entries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null;
}

/** 매치에서 본인을 제외하고 팀별로 고르게 참가자를 샘플링 */
function sampleParticipants(match: MatchInfo, selfPuuid: string) {
  const others = match.participants.filter((p) => p.puuid !== selfPuuid);
  const byTeam = new Map<number, typeof others>();
  for (const p of others) {
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }
  return [...byTeam.values()].flatMap((team) => team.slice(0, SAMPLES_PER_TEAM));
}

export async function estimateMmr(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<MmrEstimate> {
  const account = await getAccountByRiotId(platform, gameName, tagLine);
  const [entries, matchIds] = await Promise.all([
    getLeagueEntries(platform, account.puuid),
    getRankedMatchIds(platform, account.puuid, MATCH_COUNT),
  ]);

  const solo = soloQueueEntry(entries);
  const currentPoints = solo
    ? rankToPoints(solo.tier, solo.rank, solo.leaguePoints)
    : null;

  const matches = await Promise.all(
    matchIds.map((id) => getMatch(platform, id)),
  );

  // 조회할 참가자 puuid를 매치 전체에서 모아 중복 제거 후 한 번씩만 조회
  const sampledByMatch = matches.map((m) => sampleParticipants(m, account.puuid));
  const uniquePuuids = [...new Set(sampledByMatch.flat().map((p) => p.puuid))];

  const pointsByPuuid = new Map<string, number>();
  await Promise.all(
    uniquePuuids.map(async (puuid) => {
      try {
        const entry = soloQueueEntry(await getLeagueEntries(platform, puuid));
        if (entry) {
          pointsByPuuid.set(
            puuid,
            rankToPoints(entry.tier, entry.rank, entry.leaguePoints),
          );
        }
      } catch {
        // 일부 참가자 조회 실패는 표본에서 제외하고 계속 진행
      }
    }),
  );

  const matchSamples: MatchSample[] = matches.map((m, i) => {
    const self = m.participants.find((p) => p.puuid === account.puuid);
    const sampled = sampledByMatch[i]
      .map((p) => pointsByPuuid.get(p.puuid))
      .filter((v): v is number => v !== undefined);
    const lobbyPoints = sampled.length
      ? sampled.reduce((a, b) => a + b, 0) / sampled.length
      : null;
    return {
      matchId: m.matchId,
      gameCreation: m.gameCreation,
      win: self?.win ?? false,
      championName: self?.championName ?? "",
      kda: self ? `${self.kills}/${self.deaths}/${self.assists}` : "",
      lobbyPoints,
      sampleSize: sampled.length,
    };
  });

  // 최신 경기 순으로 정렬돼 있다고 가정(match-v5가 최신순 반환)하고 가중 평균
  let weightedSum = 0;
  let weightTotal = 0;
  matchSamples.forEach((s, i) => {
    if (s.lobbyPoints === null) return;
    const w = Math.pow(RECENCY_DECAY, i) * Math.min(s.sampleSize / 4, 1.5);
    weightedSum += s.lobbyPoints * w;
    weightTotal += w;
  });

  const played = matchSamples.length;
  const wins = matchSamples.filter((s) => s.win).length;
  const recentWinrate = played ? wins / played : null;

  let estimatedPoints: number | null = null;
  if (weightTotal > 0) {
    estimatedPoints = weightedSum / weightTotal;
    if (recentWinrate !== null) {
      estimatedPoints += (recentWinrate - 0.5) * WINRATE_ADJUST;
    }
  }

  const totalSamples = matchSamples.reduce((a, s) => a + s.sampleSize, 0);
  const confidence =
    totalSamples >= 30 ? "high" : totalSamples >= 15 ? "medium" : "low";

  return {
    account: { gameName: account.gameName, tagLine: account.tagLine },
    soloEntry: solo,
    currentPoints,
    currentRank: currentPoints !== null ? pointsToRank(currentPoints) : null,
    estimatedPoints,
    estimatedRank:
      estimatedPoints !== null ? pointsToRank(estimatedPoints) : null,
    gap:
      estimatedPoints !== null && currentPoints !== null
        ? Math.round(estimatedPoints - currentPoints)
        : null,
    recentWinrate,
    matches: matchSamples,
    sampledPlayers: pointsByPuuid.size,
    confidence,
  };
}
