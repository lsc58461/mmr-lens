// 키-값 JSON 캐시. DATABASE_URL이 있으면 Postgres(cache_entries 테이블),
// 없으면 인메모리 Map으로 동작한다. 라이엇 API 호출량을 줄이는 게 목적.

import "server-only";

interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

class MemoryStore implements CacheStore {
  private map = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.map.size > 10_000) this.map.clear();
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

class PostgresStore implements CacheStore {
  private db: Promise<{
    sql: import("postgres").Sql;
  }>;

  constructor(url: string) {
    this.db = (async () => {
      const postgres = (await import("postgres")).default;
      const sql = postgres(url, {
        max: 3,
        prepare: false,
        // CREATE TABLE IF NOT EXISTS의 "already exists" NOTICE 로그 억제
        onnotice: () => {},
      });
      await sql`
        CREATE TABLE IF NOT EXISTS cache_entries (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          expires_at timestamptz NOT NULL
        )`;
      return { sql };
    })();
  }

  async get<T>(key: string): Promise<T | null> {
    const { sql } = await this.db;
    const rows = await sql`
      SELECT value FROM cache_entries
      WHERE key = ${key} AND expires_at > now()`;
    return rows.length ? (rows[0].value as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const { sql } = await this.db;
    await sql`
      INSERT INTO cache_entries (key, value, expires_at)
      VALUES (${key}, ${sql.json(value as never)}, now() + ${`${ttlSeconds} seconds`}::interval)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`;
  }
}

const globalForCache = globalThis as unknown as { __mmrCache?: CacheStore };

export const cache: CacheStore =
  globalForCache.__mmrCache ??
  (globalForCache.__mmrCache = process.env.DATABASE_URL
    ? new PostgresStore(process.env.DATABASE_URL)
    : new MemoryStore());

/** 캐시에 있으면 반환, 없으면 fn 실행 후 저장 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  await cache.set(key, value, ttlSeconds);
  return value;
}
