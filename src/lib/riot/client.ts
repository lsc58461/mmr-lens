import "server-only";
import { riotLimiter } from "./limiter";
import { cached } from "@/lib/cache";
import {
  PLATFORM_TO_ROUTING,
  RiotApiError,
  type LeagueEntry,
  type MatchInfo,
  type PlatformRegion,
  type RiotAccount,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function riotFetch<T>(url: string): Promise<T> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) throw new Error("RIOT_API_KEY가 설정되지 않았습니다 (.env.local)");

  for (let attempt = 0; attempt < 3; attempt++) {
    await riotLimiter.acquire();
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
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
      await sleep(retryAfter * 1000 + 200);
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
  const key = `account:${routing}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
  return cached(key, 60 * 60 * 24, () =>
    riotFetch<RiotAccount>(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    ),
  );
}

/** 현재 랭크(솔로랭크/자유랭크) 조회. 언랭이면 빈 배열 */
export function getLeagueEntries(
  platform: PlatformRegion,
  puuid: string,
): Promise<LeagueEntry[]> {
  return cached(`league:${platform}:${puuid}`, 60 * 30, () =>
    riotFetch<LeagueEntry[]>(
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
    ),
  );
}

/** 최근 솔로랭크 매치 ID 목록 */
export function getRankedMatchIds(
  platform: PlatformRegion,
  puuid: string,
  count: number,
): Promise<string[]> {
  const routing = PLATFORM_TO_ROUTING[platform];
  return cached(`matchids:${routing}:${puuid}:${count}`, 60 * 10, () =>
    riotFetch<string[]>(
      `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&type=ranked&start=0&count=${count}`,
    ),
  );
}

/** 매치 상세. 종료된 매치는 불변이므로 길게 캐시한다 */
export function getMatch(
  platform: PlatformRegion,
  matchId: string,
): Promise<MatchInfo> {
  const routing = PLATFORM_TO_ROUTING[platform];
  return cached(`match:${matchId}`, 60 * 60 * 24 * 7, async () => {
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
