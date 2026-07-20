import "server-only";
import { createHash } from "crypto";
import { currentPriority, riotLimiter } from "./limiter";
import { cache, cached } from "@/lib/cache";
import {
  PLATFORM_TO_ROUTING,
  RiotApiError,
  type LeagueEntry,
  type MatchInfo,
  type PlatformRegion,
  type RiotAccount,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// PUUID는 API 키 단위로 암호화되므로, 다른 키로 받아둔 PUUID가 섞이면
// "Exception decrypting" 400이 난다. 캐시 키에 현재 키의 지문을 붙여
// 키가 바뀌면 관련 캐시가 자동으로 무효화되게 한다(옛 행은 삭제하지 않음).
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

/** Riot ID(게임명#태그)로 계정 조회 */
export function getAccountByRiotId(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<RiotAccount> {
  const routing = PLATFORM_TO_ROUTING[platform];
  const key = `${keyFp()}:account:${routing}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
  return cached(key, 60 * 60 * 24, () =>
    riotFetch<RiotAccount>(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    ),
  );
}

/**
 * 현재 랭크(솔로랭크/자유랭크) 조회. 언랭이면 빈 배열.
 * 참가자 표본용으로는 6시간 캐시를 쓴다 — 로비 평균에 들어갈 뿐이라
 * 몇 시간 묵은 랭크여도 오차가 미미하고, 전체 API 콜의 대부분을 차지하는
 * 이 호출의 재사용률이 크게 오른다. 검색 대상 본인 랭크는 bypassCache로
 * 항상 최신을 받아 표시 정확도를 유지한다.
 */
export async function getLeagueEntries(
  platform: PlatformRegion,
  puuid: string,
  bypassCache = false,
): Promise<LeagueEntry[]> {
  const key = `${keyFp()}:league:${platform}:${puuid}`;
  const url = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
  const TTL = 60 * 60 * 6;
  if (bypassCache) {
    const entries = await riotFetch<LeagueEntry[]>(url);
    await cache.set(key, entries, TTL);
    return entries;
  }
  return cached(key, TTL, () => riotFetch<LeagueEntry[]>(url));
}

/** 소환사 프로필(아이콘/레벨) 조회 */
export function getSummoner(
  platform: PlatformRegion,
  puuid: string,
): Promise<{ profileIconId: number; summonerLevel: number }> {
  return cached(`${keyFp()}:summoner:${platform}:${puuid}`, 60 * 60 * 24, () =>
    riotFetch<{ profileIconId: number; summonerLevel: number }>(
      `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
    ),
  );
}

/** 최근 솔로랭크 매치 ID 목록. bypassCache면 강제로 새로 조회 후 캐시를 갱신한다 */
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

/** 매치 상세. 종료된 매치는 불변이므로 사실상 무기한 캐시한다 */
export function getMatch(
  platform: PlatformRegion,
  matchId: string,
): Promise<MatchInfo> {
  const routing = PLATFORM_TO_ROUTING[platform];
  // 매치 상세도 참가자 puuid를 담고 있어 키 지문으로 스코프한다
  return cached(`${keyFp()}:match:${matchId}`, 60 * 60 * 24 * 365, async () => {
    const raw = await riotFetch<{
      info: {
        gameCreation: number;
        gameDuration: number;
        queueId: number;
        participants: MatchInfo["participants"];
      };
    }>(
      `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
    );
    // 캐시 용량을 아끼기 위해 필요한 필드만 남긴다
    return {
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
    } satisfies MatchInfo;
  });
}
