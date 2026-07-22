// 도메인 테이블 저장 계층. 신선도(TTL) 판단은 타임스탬프 컬럼 + 호출부 비교로 한다.
// puuid가 들어가는 테이블(summoners/matches/league_snapshots)은 API 키 지문(fp)으로 스코프.

import "server-only";
import { getSql } from "./db";
import type { MmrEstimate } from "./mmr/estimate";
import type { LeagueEntry, MatchInfo, PlatformRegion } from "./riot/types";

const fresh = (updatedAt: Date | string, maxAgeMs: number): boolean =>
  Date.now() - new Date(updatedAt).getTime() < maxAgeMs;

// ── 소환사 ──────────────────────────────────────────────

export interface SummonerRow {
  puuid: string;
  game_name: string;
  tag_line: string;
  profile_icon_id: number | null;
  summoner_level: number | null;
  updated_at: string;
}

export async function findSummonerByName(
  fp: string,
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  maxAgeMs: number,
): Promise<SummonerRow | null> {
  const sql = await getSql();
  const rows = await sql`
    SELECT puuid, game_name, tag_line, profile_icon_id, summoner_level, updated_at
    FROM summoners
    WHERE fp = ${fp} AND platform = ${platform}
      AND lower(game_name) = ${gameName.toLowerCase()}
      AND lower(tag_line) = ${tagLine.toLowerCase()}`;
  const row = rows[0] as SummonerRow | undefined;
  return row && fresh(row.updated_at, maxAgeMs) ? row : null;
}

export async function findSummonerByPuuid(
  fp: string,
  puuid: string,
): Promise<SummonerRow | null> {
  const sql = await getSql();
  const rows = await sql`
    SELECT puuid, game_name, tag_line, profile_icon_id, summoner_level, updated_at
    FROM summoners WHERE fp = ${fp} AND puuid = ${puuid}`;
  return (rows[0] as SummonerRow | undefined) ?? null;
}

export async function upsertSummonerNames(
  fp: string,
  platform: PlatformRegion,
  puuid: string,
  gameName: string,
  tagLine: string,
): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO summoners (fp, puuid, platform, game_name, tag_line)
    VALUES (${fp}, ${puuid}, ${platform}, ${gameName}, ${tagLine})
    ON CONFLICT (fp, puuid) DO UPDATE
    SET game_name = EXCLUDED.game_name, tag_line = EXCLUDED.tag_line,
        platform = EXCLUDED.platform, updated_at = now()`;
}

export async function updateSummonerProfile(
  fp: string,
  puuid: string,
  profileIconId: number,
  summonerLevel: number,
): Promise<void> {
  const sql = await getSql();
  await sql`
    UPDATE summoners
    SET profile_icon_id = ${profileIconId}, summoner_level = ${summonerLevel},
        updated_at = now()
    WHERE fp = ${fp} AND puuid = ${puuid}`;
}

// ── 매치 (불변) ─────────────────────────────────────────

export async function getMatchRow(
  fp: string,
  matchId: string,
): Promise<MatchInfo | null> {
  const sql = await getSql();
  const rows = await sql`
    SELECT match_id, game_creation, game_duration, queue_id, participants
    FROM matches WHERE fp = ${fp} AND match_id = ${matchId}`;
  const r = rows[0];
  if (!r) return null;
  return {
    matchId: r.match_id as string,
    gameCreation: Number(r.game_creation),
    gameDuration: r.game_duration as number,
    queueId: r.queue_id as number,
    participants: r.participants as MatchInfo["participants"],
  };
}

export async function saveMatchRow(
  fp: string,
  platform: PlatformRegion,
  match: MatchInfo,
): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO matches (fp, match_id, platform, game_creation, game_duration, queue_id, participants)
    VALUES (${fp}, ${match.matchId}, ${platform}, ${match.gameCreation},
            ${match.gameDuration}, ${match.queueId}, ${sql.json(match.participants as never)})
    ON CONFLICT (fp, match_id) DO NOTHING`;
}

// ── 랭크 스냅샷 (히스토리 적재) ─────────────────────────

export async function latestLeagueSnapshot(
  fp: string,
  platform: PlatformRegion,
  puuid: string,
  maxAgeMs: number,
): Promise<LeagueEntry[] | null> {
  const sql = await getSql();
  const rows = await sql`
    SELECT entries, created_at FROM league_snapshots
    WHERE fp = ${fp} AND platform = ${platform} AND puuid = ${puuid}
    ORDER BY created_at DESC LIMIT 1`;
  const r = rows[0];
  if (!r || !fresh(r.created_at as string, maxAgeMs)) return null;
  return r.entries as LeagueEntry[];
}

export async function insertLeagueSnapshot(
  fp: string,
  platform: PlatformRegion,
  puuid: string,
  entries: LeagueEntry[],
): Promise<void> {
  const sql = await getSql();
  const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  await sql`
    INSERT INTO league_snapshots
      (fp, platform, puuid, solo_tier, solo_rank, solo_lp, solo_wins, solo_losses, entries)
    VALUES (${fp}, ${platform}, ${puuid}, ${solo?.tier ?? null}, ${solo?.rank ?? null},
            ${solo?.leaguePoints ?? null}, ${solo?.wins ?? null}, ${solo?.losses ?? null},
            ${sql.json(entries as never)})`;
}

export interface LeagueSnapRow {
  solo_tier: string | null;
  solo_rank: string | null;
  solo_lp: number | null;
  solo_wins: number | null;
  solo_losses: number | null;
  created_at: string;
}

/** 가장 최근 스냅샷 (신선도 무관) — 승급/강등 감지 비교용 */
export async function latestLeagueSnapshotAny(
  fp: string,
  platform: PlatformRegion,
  puuid: string,
): Promise<LeagueSnapRow | null> {
  const sql = await getSql();
  const rows = await sql`
    SELECT solo_tier, solo_rank, solo_lp, solo_wins, solo_losses, created_at
    FROM league_snapshots
    WHERE fp = ${fp} AND platform = ${platform} AND puuid = ${puuid}
    ORDER BY created_at DESC LIMIT 1`;
  return (rows[0] as LeagueSnapRow | undefined) ?? null;
}

/** 특정 소환사의 랭크 스냅샷 히스토리 (오래된 순) — LP 득실 추적용 */
export async function listLeagueSnapshots(
  fp: string,
  platform: PlatformRegion,
  puuid: string,
  limit = 200,
): Promise<LeagueSnapRow[]> {
  const sql = await getSql();
  const rows = await sql`
    SELECT solo_tier, solo_rank, solo_lp, solo_wins, solo_losses, created_at
    FROM league_snapshots
    WHERE fp = ${fp} AND platform = ${platform} AND puuid = ${puuid}
    ORDER BY created_at ASC LIMIT ${limit}`;
  return rows as unknown as LeagueSnapRow[];
}

// ── 분석 결과 ───────────────────────────────────────────

export async function getAnalysis(
  kind: "quick" | "deep",
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<MmrEstimate | null> {
  const sql = await getSql();
  const rows = await sql`
    SELECT result FROM analyses
    WHERE platform = ${platform} AND kind = ${kind}
      AND game_name_lower = ${gameName.toLowerCase()}
      AND tag_line_lower = ${tagLine.toLowerCase()}`;
  return (rows[0]?.result as MmrEstimate | undefined) ?? null;
}

export async function saveAnalysis(
  kind: "quick" | "deep",
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  result: MmrEstimate,
): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO analyses
      (platform, game_name_lower, tag_line_lower, kind, game_name, tag_line,
       algo_version, latest_match_id, analyzed_at, result)
    VALUES (${platform}, ${gameName.toLowerCase()}, ${tagLine.toLowerCase()}, ${kind},
            ${result.account.gameName}, ${result.account.tagLine},
            ${result.algoVersion ?? null}, ${result.latestMatchId ?? null},
            ${result.analyzedAt ? new Date(result.analyzedAt) : null},
            ${sql.json(result as never)})
    ON CONFLICT (platform, game_name_lower, tag_line_lower, kind) DO UPDATE
    SET game_name = EXCLUDED.game_name, tag_line = EXCLUDED.tag_line,
        algo_version = EXCLUDED.algo_version, latest_match_id = EXCLUDED.latest_match_id,
        analyzed_at = EXCLUDED.analyzed_at, result = EXCLUDED.result, updated_at = now()`;
}

export interface AnalysisMeta {
  platform: string;
  game_name_lower: string;
  tag_line_lower: string;
  kind: "quick" | "deep";
  algo_version: number | null;
  latest_match_id: string | null;
  analyzed_at: string | null;
}

export async function listAnalysesMeta(): Promise<AnalysisMeta[]> {
  const sql = await getSql();
  const rows = await sql`
    SELECT platform, game_name_lower, tag_line_lower, kind,
           algo_version, latest_match_id, analyzed_at
    FROM analyses`;
  return rows as unknown as AnalysisMeta[];
}

export interface QuickAnalysisPage {
  platform: string;
  game_name: string;
  tag_line: string;
  analyzed_at: string | null;
}

export async function listQuickAnalysisPages(): Promise<QuickAnalysisPage[]> {
  const sql = await getSql();
  const rows = await sql`
    SELECT platform, game_name, tag_line, analyzed_at
    FROM analyses WHERE kind = 'quick'`;
  return rows as unknown as QuickAnalysisPage[];
}

// ── 최근 검색 ───────────────────────────────────────────

export interface RecentSearchInput {
  platform: PlatformRegion;
  gameName: string;
  tagLine: string;
  currentLabel: string | null;
  currentTier: string | null;
  estimatedLabel: string | null;
  estimatedTier: string | null;
  estimatedPoints: number | null;
}

export async function upsertRecentSearch(r: RecentSearchInput): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO recent_searches
      (platform, game_name_lower, tag_line_lower, game_name, tag_line,
       current_label, current_tier, estimated_label, estimated_tier, estimated_points, searched_at)
    VALUES (${r.platform}, ${r.gameName.toLowerCase()}, ${r.tagLine.toLowerCase()},
            ${r.gameName}, ${r.tagLine}, ${r.currentLabel}, ${r.currentTier},
            ${r.estimatedLabel}, ${r.estimatedTier}, ${r.estimatedPoints}, now())
    ON CONFLICT (platform, game_name_lower, tag_line_lower) DO UPDATE
    SET game_name = EXCLUDED.game_name, tag_line = EXCLUDED.tag_line,
        current_label = EXCLUDED.current_label, current_tier = EXCLUDED.current_tier,
        estimated_label = EXCLUDED.estimated_label, estimated_tier = EXCLUDED.estimated_tier,
        estimated_points = EXCLUDED.estimated_points, searched_at = now()`;
}

export interface RecentSearchRow {
  platform: PlatformRegion;
  game_name: string;
  tag_line: string;
  current_label: string | null;
  current_tier: string | null;
  estimated_label: string | null;
  estimated_tier: string | null;
  estimated_points: number | null;
  searched_at: string;
}

export async function listRecentSearches(
  limit: number,
): Promise<RecentSearchRow[]> {
  const sql = await getSql();
  const rows = await sql`
    SELECT platform, game_name, tag_line, current_label, current_tier,
           estimated_label, estimated_tier, estimated_points, searched_at
    FROM recent_searches ORDER BY searched_at DESC LIMIT ${limit}`;
  return rows as unknown as RecentSearchRow[];
}

export interface SummonerSuggestion {
  game_name: string;
  tag_line: string;
  current_label: string | null;
  current_tier: string | null;
}

/** 소환사 자동완성 — 기록된 검색에서 부분 일치, 최근 검색 순 */
export async function searchRecentSummoners(
  platform: PlatformRegion,
  query: string,
  limit = 8,
): Promise<SummonerSuggestion[]> {
  const sql = await getSql();
  const q = `%${query.toLowerCase()}%`;
  const rows = await sql`
    SELECT game_name, tag_line, current_label, current_tier
    FROM recent_searches
    WHERE platform = ${platform}
      AND (game_name_lower LIKE ${q}
           OR game_name_lower || '#' || tag_line_lower LIKE ${q})
    ORDER BY searched_at DESC LIMIT ${limit}`;
  return rows as unknown as SummonerSuggestion[];
}

/** 최근 30일 내 검색된 소환사인지 — 디스코드 알림 대상 필터 */
export async function isRecentlySearched(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql`
    SELECT 1 FROM recent_searches
    WHERE platform = ${platform}
      AND game_name_lower = ${gameName.toLowerCase()}
      AND tag_line_lower = ${tagLine.toLowerCase()}
      AND searched_at > now() - interval '30 days'`;
  return rows.length > 0;
}

/** 특정 소환사가 참가한 저장된 매치들 (결산·궁합용, API 호출 없음) */
export async function listMatchesForPuuid(
  fp: string,
  puuid: string,
  limit = 500,
): Promise<MatchInfo[]> {
  const sql = await getSql();
  const rows = await sql`
    SELECT match_id, game_creation, game_duration, queue_id, participants
    FROM matches
    WHERE fp = ${fp} AND participants @> ${sql.json([{ puuid }] as never)}
    ORDER BY game_creation DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    matchId: r.match_id as string,
    gameCreation: Number(r.game_creation),
    gameDuration: r.game_duration as number,
    queueId: r.queue_id as number,
    participants: r.participants as MatchInfo["participants"],
  }));
}

// ── 인증된 소환사 (디스코드 알림 대상) ───────────────────

export async function insertVerifiedSummoner(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  puuid: string,
  discord?: { id: string; username: string },
): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO verified_summoners
      (platform, game_name_lower, tag_line_lower, game_name, tag_line, puuid,
       discord_user_id, discord_username)
    VALUES (${platform}, ${gameName.toLowerCase()}, ${tagLine.toLowerCase()},
            ${gameName}, ${tagLine}, ${puuid},
            ${discord?.id ?? null}, ${discord?.username ?? null})
    ON CONFLICT (platform, game_name_lower, tag_line_lower) DO UPDATE
    SET puuid = EXCLUDED.puuid, active = true, verified_at = now(),
        discord_user_id = COALESCE(EXCLUDED.discord_user_id, verified_summoners.discord_user_id),
        discord_username = COALESCE(EXCLUDED.discord_username, verified_summoners.discord_username)`;
}

export async function isVerifiedSummoner(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql`
    SELECT 1 FROM verified_summoners
    WHERE platform = ${platform} AND active = true
      AND game_name_lower = ${gameName.toLowerCase()}
      AND tag_line_lower = ${tagLine.toLowerCase()}`;
  return rows.length > 0;
}

export interface VerifiedRow {
  platform: PlatformRegion;
  game_name: string;
  tag_line: string;
  active: boolean;
  verified_at: string;
  discord_username: string | null;
}

export async function listVerifiedSummoners(): Promise<VerifiedRow[]> {
  const sql = await getSql();
  const rows = await sql`
    SELECT platform, game_name, tag_line, active, verified_at, discord_username
    FROM verified_summoners ORDER BY verified_at DESC`;
  return rows as unknown as VerifiedRow[];
}

export async function setVerifiedActive(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  active: boolean,
): Promise<void> {
  const sql = await getSql();
  await sql`
    UPDATE verified_summoners SET active = ${active}
    WHERE platform = ${platform}
      AND game_name_lower = ${gameName.toLowerCase()}
      AND tag_line_lower = ${tagLine.toLowerCase()}`;
}

// ── 앱 설정 ─────────────────────────────────────────────

export async function getSetting<T>(key: string): Promise<T | null> {
  const sql = await getSql();
  const rows = await sql`SELECT value FROM app_settings WHERE key = ${key}`;
  return (rows[0]?.value as T | undefined) ?? null;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${key}, ${sql.json(value as never)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// ── 어드민 ──────────────────────────────────────────────

export async function adminFindUser(
  username: string,
): Promise<{ salt: string; hash: string } | null> {
  const sql = await getSql();
  const rows = await sql`
    SELECT salt, hash FROM admin_users WHERE username = ${username}`;
  return (rows[0] as { salt: string; hash: string } | undefined) ?? null;
}

export async function adminInsertSession(
  token: string,
  ttlSeconds: number,
): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO admin_sessions (token, expires_at)
    VALUES (${token}, now() + ${`${ttlSeconds} seconds`}::interval)`;
}

export async function adminSessionValid(token: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql`
    SELECT 1 FROM admin_sessions WHERE token = ${token} AND expires_at > now()`;
  return rows.length > 0;
}

export async function adminExpireSession(token: string): Promise<void> {
  const sql = await getSql();
  await sql`UPDATE admin_sessions SET expires_at = now() WHERE token = ${token}`;
}
