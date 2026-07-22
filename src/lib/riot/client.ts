import "server-only";
import { createHash } from "crypto";
import { currentPriority, riotLimiter } from "./limiter";
import { cache, cached } from "@/lib/cache";
import {
  findSummonerByName,
  findSummonerByPuuid,
  getMatchRow,
  insertLeagueSnapshot,
  latestLeagueSnapshot,
  listLeagueSnapshots,
  saveMatchRow,
  updateSummonerProfile,
  upsertSummonerNames,
  type LeagueSnapRow,
} from "@/lib/store";
import {
  PLATFORM_TO_ROUTING,
  RiotApiError,
  type LeagueEntry,
  type MatchInfo,
  type PlatformRegion,
  type RiotAccount,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SUMMONER_FRESH_MS = 24 * 60 * 60_000;
// 참가자 랭크는 로비 평균 표본이라 수 시간 묵어도 오차 미미 — 재사용률을 높인다.
// 검색 대상 본인 랭크는 bypassCache로 항상 최신을 받아 표시 정확도를 유지한다.
const LEAGUE_FRESH_MS = 6 * 60 * 60_000;

// PUUID는 API 키 단위로 암호화되므로, 키가 바뀌면 저장 데이터를 새로 받도록
// 키 지문(fingerprint)으로 스코프한다
let cachedFp: string | null = null;
function keyFp(): string {
  if (!cachedFp) {
    cachedFp = createHash("sha256")
      .update(process.env.RIOT_API_KEY ?? "")
      .digest("hex")
      .slice(0, 8);
  }
  return cachedFp;
}

async function riotFetch<T>(url: string): Promise<T> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) throw new Error("RIOT_API_KEY가 설정되지 않았습니다 (.env.local)");

  // 429는 다른 인스턴스와의 합산 한도 초과일 수 있어 더 끈질기게 재시도한다
  for (let attempt = 0; attempt < 6; attempt++) {
    await riotLimiter.acquire(currentPriority());
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "X-Riot-Token": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // 커넥션 정체/타임아웃 — 잠시 후 재시도
      await sleep(500 * (attempt + 1));
      continue;
    }
    if (res.ok) return res.json() as Promise<T>;
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "5");
      await sleep(retryAfter * 1000 + 500);
      continue;
    }
    if (res.status >= 500) {
      await sleep(500 * (attempt + 1));
      continue;
    }
    throw new RiotApiError(res.status, url);
  }
  throw new RiotApiError(429, url);
}

/** Riot ID(게임명#태그)로 계정 조회 — summoners 테이블 24h 신선도 */
export async function getAccountByRiotId(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<RiotAccount> {
  const row = await findSummonerByName(
    keyFp(),
    platform,
    gameName,
    tagLine,
    SUMMONER_FRESH_MS,
  );
  if (row) {
    return { puuid: row.puuid, gameName: row.game_name, tagLine: row.tag_line };
  }
  const routing = PLATFORM_TO_ROUTING[platform];
  const account = await riotFetch<RiotAccount>(
    `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  );
  await upsertSummonerNames(
    keyFp(),
    platform,
    account.puuid,
    account.gameName,
    account.tagLine,
  );
  return account;
}

/** 소환사 프로필(아이콘/레벨) 조회 */
export async function getSummoner(
  platform: PlatformRegion,
  puuid: string,
): Promise<{ profileIconId: number; summonerLevel: number }> {
  const row = await findSummonerByPuuid(keyFp(), puuid);
  if (
    row?.profile_icon_id != null &&
    row.summoner_level != null &&
    Date.now() - new Date(row.updated_at).getTime() < SUMMONER_FRESH_MS
  ) {
    return {
      profileIconId: row.profile_icon_id,
      summonerLevel: row.summoner_level,
    };
  }
  const summoner = await riotFetch<{
    profileIconId: number;
    summonerLevel: number;
  }>(
    `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
  );
  await updateSummonerProfile(
    keyFp(),
    puuid,
    summoner.profileIconId,
    summoner.summonerLevel,
  ).catch(() => {});
  return summoner;
}

/**
 * 현재 랭크(솔로랭크/자유랭크) 조회. 언랭이면 빈 배열.
 * league_snapshots에 히스토리로 적재된다 (향후 LP 득실 추적 기반).
 */
export async function getLeagueEntries(
  platform: PlatformRegion,
  puuid: string,
  bypassCache = false,
): Promise<LeagueEntry[]> {
  if (!bypassCache) {
    const snap = await latestLeagueSnapshot(
      keyFp(),
      platform,
      puuid,
      LEAGUE_FRESH_MS,
    );
    if (snap) return snap;
  }
  const entries = await riotFetch<LeagueEntry[]>(
    `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
  );
  await insertLeagueSnapshot(keyFp(), platform, puuid, entries).catch(() => {});
  return entries;
}

/** 랭크 스냅샷 히스토리 — LP 득실 추적용 (API 호출 없음, DB만 조회) */
export function getLeagueHistory(
  platform: PlatformRegion,
  puuid: string,
): Promise<LeagueSnapRow[]> {
  return listLeagueSnapshots(keyFp(), platform, puuid);
}

/** 최근 솔로랭크 매치 ID 목록 — 짧은 신선도라 KV 캐시 유지 */
export async function getRankedMatchIds(
  platform: PlatformRegion,
  puuid: string,
  count: number,
  bypassCache = false,
): Promise<string[]> {
  const routing = PLATFORM_TO_ROUTING[platform];
  const key = `${keyFp()}:matchids:${routing}:${puuid}:${count}`;
  const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&type=ranked&start=0&count=${count}`;
  if (bypassCache) {
    const ids = await riotFetch<string[]>(url);
    await cache.set(key, ids, 60 * 10);
    return ids;
  }
  return cached(key, 60 * 10, () => riotFetch<string[]>(url));
}

/** 매치 상세 — 불변 데이터라 matches 테이블에 영구 보관 */
export async function getMatch(
  platform: PlatformRegion,
  matchId: string,
): Promise<MatchInfo> {
  const row = await getMatchRow(keyFp(), matchId);
  if (row) return row;

  const routing = PLATFORM_TO_ROUTING[platform];
  const raw = await riotFetch<{
    info: {
      gameCreation: number;
      gameDuration: number;
      queueId: number;
      participants: MatchInfo["participants"];
    };
  }>(`https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`);
  // 저장 용량을 아끼기 위해 필요한 필드만 남긴다
  const match: MatchInfo = {
    matchId,
    gameCreation: raw.info.gameCreation,
    gameDuration: raw.info.gameDuration,
    queueId: raw.info.queueId,
    participants: raw.info.participants.map((p) => ({
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagline: p.riotIdTagline,
      teamId: p.teamId,
      win: p.win,
      championName: p.championName,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      teamPosition: p.teamPosition,
    })),
  };
  await saveMatchRow(keyFp(), platform, match).catch(() => {});
  return match;
}
