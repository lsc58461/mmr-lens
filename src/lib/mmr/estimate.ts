// MMR 추정 파이프라인.
// 1) 최근 솔로랭크 매치를 가져와 리메이크(5분 미만)를 제외하고
// 2) 각 매치에서 팀별로 고르게 뽑은 참가자들의 "현재 랭크"로 로비 절사평균을 구한 뒤
// 3) 오래된 경기부터 순서대로 [로비 관측 보정 → Elo 승패 업데이트]를 반복해
//    최종 레이팅을 추정한다. 로비 평균 = 매치메이커가 본 내 실력, Elo = 기대 대비 승패 성과.
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

const MIN_GAME_DURATION = 300; // 5분 미만은 리메이크로 간주하고 제외
const OBS_WEIGHT = 0.35; // 로비 평균(매치메이커 관측)을 레이팅에 반영하는 비율
const ELO_K = 32; // Elo 승패 업데이트 K-팩터 (디비전 100pt 스케일 기준)

export interface AnalysisDepth {
  matches: number; // 분석할 경기 수
  samplesPerTeam: number; // 매치당 팀별 랭크 조회 인원
}

// 빠른 추정: 개발 키(2분당 100회)로도 수 초 안에 끝나는 표본
export const QUICK_DEPTH: AnalysisDepth = { matches: 8, samplesPerTeam: 3 };
// 정밀 분석: 20경기 × 본인 제외 전원(내 팀 4 + 상대 팀 5)
export const DEEP_DEPTH: AnalysisDepth = { matches: 20, samplesPerTeam: 5 };

export interface MatchSample {
  matchId: string;
  gameCreation: number;
  win: boolean;
  championName: string;
  kda: string;
  lobbyPoints: number | null; // 로비 절사평균 MMR 포인트 (표본 없으면 null)
  sampleSize: number;
  ratingAfter: number | null; // 이 경기까지 반영한 추정 레이팅 (그래프용)
}

export interface MmrEstimate {
  account: { gameName: string; tagLine: string };
  soloEntry: LeagueEntry | null;
  currentPoints: number | null;
  currentRank: RankLabel | null;
  estimatedPoints: number | null;
  estimatedRank: RankLabel | null;
  errorMargin: number | null; // 로비 표본 분산 기반 95% 오차범위(±pt)
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
function sampleParticipants(
  match: MatchInfo,
  selfPuuid: string,
  samplesPerTeam: number,
) {
  const others = match.participants.filter((p) => p.puuid !== selfPuuid);
  const byTeam = new Map<number, typeof others>();
  for (const p of others) {
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }
  return [...byTeam.values()].flatMap((team) => team.slice(0, samplesPerTeam));
}

/** 절사평균: 표본이 5명 이상이면 최고/최저 1명씩 제외 (부캐·복귀 유저 이상치 완화) */
function trimmedMean(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trimmed = sorted.length >= 5 ? sorted.slice(1, -1) : sorted;
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

export async function estimateMmr(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  depth: AnalysisDepth = QUICK_DEPTH,
  onProgress?: (done: number, total: number) => void,
): Promise<MmrEstimate> {
  // 리메이크 제외분을 감안해 여유 있게 조회
  const fetchCount = Math.min(depth.matches + Math.ceil(depth.matches / 4), 100);
  const account = await getAccountByRiotId(platform, gameName, tagLine);
  const [entries, matchIds] = await Promise.all([
    getLeagueEntries(platform, account.puuid),
    getRankedMatchIds(platform, account.puuid, fetchCount),
  ]);

  const solo = soloQueueEntry(entries);
  const currentPoints = solo
    ? rankToPoints(solo.tier, solo.rank, solo.leaguePoints)
    : null;

  const allMatches = await Promise.all(
    matchIds.map((id) => getMatch(platform, id)),
  );
  const matches = allMatches
    .filter((m) => m.gameDuration >= MIN_GAME_DURATION)
    .slice(0, depth.matches);

  // 조회할 참가자 puuid를 매치 전체에서 모아 중복 제거 후 한 번씩만 조회
  const sampledByMatch = matches.map((m) =>
    sampleParticipants(m, account.puuid, depth.samplesPerTeam),
  );
  const uniquePuuids = [...new Set(sampledByMatch.flat().map((p) => p.puuid))];

  const pointsByPuuid = new Map<string, number>();
  let progressDone = 0;
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
      } finally {
        onProgress?.(++progressDone, uniquePuuids.length);
      }
    }),
  );

  // match-v5는 최신순 반환 — 표시용 배열도 최신순 유지
  const matchSamples: MatchSample[] = matches.map((m, i) => {
    const self = m.participants.find((p) => p.puuid === account.puuid);
    const sampled = sampledByMatch[i]
      .map((p) => pointsByPuuid.get(p.puuid))
      .filter((v): v is number => v !== undefined);
    return {
      matchId: m.matchId,
      gameCreation: m.gameCreation,
      win: self?.win ?? false,
      championName: self?.championName ?? "",
      kda: self ? `${self.kills}/${self.deaths}/${self.assists}` : "",
      lobbyPoints: trimmedMean(sampled),
      sampleSize: sampled.length,
      ratingAfter: null,
    };
  });

  // 오래된 경기부터 순차 추정:
  //  - 로비 평균이 있으면 관측 보정(레이팅을 로비 쪽으로 OBS_WEIGHT만큼 이동)
  //  - 이어서 Elo 업데이트: 로비가 강할수록 승리 가치가 커진다
  let rating: number | null = null;
  for (const s of [...matchSamples].reverse()) {
    if (s.lobbyPoints !== null) {
      rating =
        rating === null
          ? s.lobbyPoints
          : rating + OBS_WEIGHT * (s.lobbyPoints - rating);
    }
    if (rating !== null) {
      const opponent = s.lobbyPoints ?? rating;
      const expected = 1 / (1 + Math.pow(10, (opponent - rating) / 400));
      rating += ELO_K * ((s.win ? 1 : 0) - expected);
    }
    s.ratingAfter = rating !== null ? Math.round(rating) : null;
  }
  const estimatedPoints = rating;

  // 로비 평균들의 표준오차 기반 95% 오차범위
  const lobbies = matchSamples
    .map((s) => s.lobbyPoints)
    .filter((v): v is number => v !== null);
  let errorMargin: number | null = null;
  if (lobbies.length >= 2) {
    const mean = lobbies.reduce((a, b) => a + b, 0) / lobbies.length;
    const variance =
      lobbies.reduce((a, v) => a + (v - mean) ** 2, 0) / (lobbies.length - 1);
    errorMargin = Math.round((1.96 * Math.sqrt(variance)) / Math.sqrt(lobbies.length));
  }

  const played = matchSamples.length;
  const wins = matchSamples.filter((s) => s.win).length;
  const recentWinrate = played ? wins / played : null;

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
    errorMargin,
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
