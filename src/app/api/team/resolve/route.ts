import { NextResponse, type NextRequest } from "next/server";
import { getStoredResult } from "@/lib/mmr/deep-jobs";
import { pointsToRank, rankToPoints } from "@/lib/mmr/rank";
import { getAccountByRiotId, getLeagueEntries } from "@/lib/riot/client";
import {
  PLATFORM_LABELS,
  RiotApiError,
  type PlatformRegion,
} from "@/lib/riot/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_PLAYERS = 10;

export interface ResolvedPlayer {
  input: string;
  name: string; // 캐노니컬 게임명#태그
  points: number;
  label: string; // "에메랄드 2 · 30LP"
  tier: string;
  source: "analysis" | "rank" | "unranked";
  error?: string;
}

// 내전 팀 밸런서용 — 각 플레이어의 실력 점수를 해석한다.
// 우선순위: 저장된 추정 MMR(정밀>빠른, 신선도 무관) → 현재 랭크 → 언랭 기본값
export async function POST(req: NextRequest) {
  let body: { region?: string; names?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const region = body.region ?? "kr";
  if (!(region in PLATFORM_LABELS)) {
    return NextResponse.json({ error: "invalid region" }, { status: 400 });
  }
  const platform = region as PlatformRegion;
  const names = (body.names ?? [])
    .map((n) => n.trim().normalize("NFKC"))
    .filter(Boolean)
    .slice(0, MAX_PLAYERS);
  if (names.length < 2) {
    return NextResponse.json({ error: "need at least 2" }, { status: 400 });
  }

  const players: ResolvedPlayer[] = await Promise.all(
    names.map(async (input): Promise<ResolvedPlayer> => {
      const hash = input.lastIndexOf("#");
      if (hash <= 0 || hash === input.length - 1) {
        return {
          input,
          name: input,
          points: 0,
          label: "-",
          tier: "IRON",
          source: "unranked",
          error: "게임명#태그 형식이 아니에요",
        };
      }
      const gameName = input.slice(0, hash);
      const tagLine = input.slice(hash + 1);
      try {
        // 1) 저장된 추정 MMR (신선도 무관 — 밸런싱 용도로는 충분)
        const stored =
          (await getStoredResult("deep", platform, gameName, tagLine)) ??
          (await getStoredResult("quick", platform, gameName, tagLine));
        if (stored?.estimatedPoints != null) {
          const pts = Math.round(stored.estimatedPoints);
          const rank = pointsToRank(pts);
          return {
            input,
            name: `${stored.account.gameName}#${stored.account.tagLine}`,
            points: pts,
            label: rank.label,
            tier: rank.tier,
            source: "analysis",
          };
        }
        // 2) 현재 랭크
        const account = await getAccountByRiotId(platform, gameName, tagLine);
        const entries = await getLeagueEntries(platform, account.puuid);
        const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
        if (solo) {
          const pts = rankToPoints(solo.tier, solo.rank, solo.leaguePoints);
          const rank = pointsToRank(pts);
          return {
            input,
            name: `${account.gameName}#${account.tagLine}`,
            points: pts,
            label: rank.label,
            tier: rank.tier,
            source: "rank",
          };
        }
        // 3) 언랭 — 실버 4 상당 기본값
        return {
          input,
          name: `${account.gameName}#${account.tagLine}`,
          points: 800,
          label: "언랭크 (기본값)",
          tier: "SILVER",
          source: "unranked",
        };
      } catch (e) {
        return {
          input,
          name: input,
          points: 0,
          label: "-",
          tier: "IRON",
          source: "unranked",
          error:
            e instanceof RiotApiError && e.status === 404
              ? "계정을 찾을 수 없어요"
              : "조회에 실패했어요",
        };
      }
    }),
  );

  return NextResponse.json({ players });
}
