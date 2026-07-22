// 공유 Postgres 클라이언트 + 스키마 초기화.
// 도메인 테이블(store.ts)과 범용 KV(cache.ts)가 모두 이 커넥션을 사용한다.

import "server-only";
import type { Sql } from "postgres";

const globalForDb = globalThis as unknown as { __mmrSql?: Promise<Sql> };

async function initSchema(sql: Sql): Promise<void> {
  // 범용 KV — 잡 상태·락·대기열·쿨다운·점검 플래그 등 휘발성 데이터 전용
  await sql`
    CREATE TABLE IF NOT EXISTS cache_entries (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      expires_at timestamptz NOT NULL
    )`;

  // 소환사 (계정 + 프로필). puuid는 API 키 단위 암호화라 fp(키 지문)로 스코프
  await sql`
    CREATE TABLE IF NOT EXISTS summoners (
      fp text NOT NULL,
      puuid text NOT NULL,
      platform text NOT NULL,
      game_name text NOT NULL,
      tag_line text NOT NULL,
      profile_icon_id int,
      summoner_level int,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (fp, puuid)
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS summoners_name_idx
    ON summoners (fp, platform, lower(game_name), lower(tag_line))`;

  // 매치 상세 (불변 데이터)
  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      fp text NOT NULL,
      match_id text NOT NULL,
      platform text NOT NULL,
      game_creation bigint NOT NULL,
      game_duration int NOT NULL,
      queue_id int NOT NULL,
      participants jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (fp, match_id)
    )`;

  // 랭크 스냅샷 — 조회 시점마다 적재(히스토리). 향후 LP 득실 추적의 기반
  await sql`
    CREATE TABLE IF NOT EXISTS league_snapshots (
      id bigserial PRIMARY KEY,
      fp text NOT NULL,
      platform text NOT NULL,
      puuid text NOT NULL,
      solo_tier text,
      solo_rank text,
      solo_lp int,
      solo_wins int,
      solo_losses int,
      entries jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS league_snap_idx
    ON league_snapshots (fp, platform, puuid, created_at DESC)`;

  // 분석 결과 (quick/deep) — 소환사·종류당 1행 upsert
  await sql`
    CREATE TABLE IF NOT EXISTS analyses (
      platform text NOT NULL,
      game_name_lower text NOT NULL,
      tag_line_lower text NOT NULL,
      kind text NOT NULL,
      game_name text NOT NULL,
      tag_line text NOT NULL,
      algo_version int,
      latest_match_id text,
      analyzed_at timestamptz,
      result jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (platform, game_name_lower, tag_line_lower, kind)
    )`;

  // 최근 검색 — 소환사당 1행 upsert (리스트 KV의 동시성 문제 해결)
  await sql`
    CREATE TABLE IF NOT EXISTS recent_searches (
      platform text NOT NULL,
      game_name_lower text NOT NULL,
      tag_line_lower text NOT NULL,
      game_name text NOT NULL,
      tag_line text NOT NULL,
      current_label text,
      current_tier text,
      estimated_label text,
      estimated_tier text,
      estimated_points double precision,
      searched_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (platform, game_name_lower, tag_line_lower)
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS recent_searches_time_idx
    ON recent_searches (searched_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      username text PRIMARY KEY,
      salt text NOT NULL,
      hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    )`;
}

async function createSql(): Promise<Sql> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다 (.env.local)");
  }
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 3, prepare: false, onnotice: () => {} });
  await initSchema(sql);
  return sql;
}

export function getSql(): Promise<Sql> {
  return (globalForDb.__mmrSql ??= createSql());
}
