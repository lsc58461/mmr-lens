import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import { cache } from "@/lib/cache";
import { getRecentSearches } from "@/lib/recent";

export const dynamic = "force-dynamic";

// 잡 키 "deepjob:kr:이름#태그" → { region, name }
function parseJobKey(key: string): { region: string; name: string } {
  const parts = key.split(":");
  return { region: parts[1] ?? "?", name: parts.slice(2).join(":") };
}

export async function GET(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const [lock, queue, recent] = await Promise.all([
    cache.get<{ key: string; at: number }>("deep-runner-lock"),
    cache.get<{ key: string; at: number }[]>("deep-queue:list"),
    getRecentSearches(),
  ]);

  let running: {
    region: string;
    name: string;
    progress: number;
    state: string;
    updatedAgoSec: number;
  } | null = null;
  if (lock && now - lock.at < 5 * 60_000) {
    const job = await cache.get<{
      state: string;
      progress: number;
      updatedAt: number;
    }>(lock.key);
    if (job) {
      running = {
        ...parseJobKey(lock.key),
        progress: job.progress,
        state: job.state,
        updatedAgoSec: Math.round((now - job.updatedAt) / 1000),
      };
    }
  }

  const waiting = (queue ?? [])
    .filter((e) => now - e.at < 60_000)
    .map((e, i) => ({
      position: i + 1,
      ...parseJobKey(e.key),
      lastSeenAgoSec: Math.round((now - e.at) / 1000),
    }));

  return NextResponse.json({
    running,
    waiting,
    recent: recent.slice(0, 15).map((r) => ({
      region: r.region,
      name: `${r.gameName}#${r.tagLine}`,
      currentLabel: r.currentLabel,
      estimatedLabel: r.estimatedLabel,
      searchedAt: r.searchedAt,
    })),
    serverTime: now,
  });
}
