import { NextResponse, type NextRequest } from "next/server";
import { getAccountByRiotId, getMatch, getRankedMatchIds } from "@/lib/riot/client";
import {
  PLATFORM_LABELS,
  RiotApiError,
  type PlatformRegion,
} from "@/lib/riot/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ID_WINDOW = 100; // 각자 최근 100경기에서 교집합 탐색
const MAX_DETAILS = 15; // 상세 조회 상한 (호출량 보호)

interface DuoGame {
  matchId: string;
  gameCreation: number;
  sameTeam: boolean;
  win: boolean; // A 기준 (sameTeam이면 둘 다 동일)
  champA: string;
  champB: string;
}

function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const s = input.trim().normalize("NFKC");
  const hash = s.lastIndexOf("#");
  if (hash <= 0 || hash === s.length - 1) return null;
  return { gameName: s.slice(0, hash), tagLine: s.slice(hash + 1) };
}

export async function POST(req: NextRequest) {
  let body: { region?: string; a?: string; b?: string };
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
  const idA = parseRiotId(body.a ?? "");
  const idB = parseRiotId(body.b ?? "");
  if (!idA || !idB) {
    return NextResponse.json(
      { error: "게임명#태그 형식으로 입력해 주세요" },
      { status: 400 },
    );
  }

  try {
    const [accA, accB] = await Promise.all([
      getAccountByRiotId(platform, idA.gameName, idA.tagLine),
      getAccountByRiotId(platform, idB.gameName, idB.tagLine),
    ]);
    if (accA.puuid === accB.puuid) {
      return NextResponse.json(
        { error: "서로 다른 두 계정을 입력해 주세요" },
        { status: 400 },
      );
    }
    const [idsA, idsB] = await Promise.all([
      getRankedMatchIds(platform, accA.puuid, ID_WINDOW),
      getRankedMatchIds(platform, accB.puuid, ID_WINDOW),
    ]);
    const setB = new Set(idsB);
    const common = idsA.filter((id) => setB.has(id)).slice(0, MAX_DETAILS);

    const games: DuoGame[] = [];
    for (const matchId of common) {
      try {
        const m = await getMatch(platform, matchId);
        const pa = m.participants.find((p) => p.puuid === accA.puuid);
        const pb = m.participants.find((p) => p.puuid === accB.puuid);
        if (!pa || !pb) continue;
        games.push({
          matchId,
          gameCreation: m.gameCreation,
          sameTeam: pa.teamId === pb.teamId,
          win: pa.win,
          champA: pa.championName,
          champB: pb.championName,
        });
      } catch {
        // 개별 매치 실패는 건너뜀
      }
    }

    const together = games.filter((g) => g.sameTeam);
    const versus = games.filter((g) => !g.sameTeam);
    return NextResponse.json({
      a: { name: `${accA.gameName}#${accA.tagLine}` },
      b: { name: `${accB.gameName}#${accB.tagLine}` },
      scanned: ID_WINDOW,
      totalCommon: idsA.filter((id) => setB.has(id)).length,
      together: {
        games: together.length,
        wins: together.filter((g) => g.win).length,
      },
      versus: {
        games: versus.length,
        aWins: versus.filter((g) => g.win).length,
      },
      games,
    });
  } catch (e) {
    if (e instanceof RiotApiError && e.status === 404) {
      return NextResponse.json(
        { error: "계정을 찾을 수 없어요 — 철자와 태그를 확인해 주세요" },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: "조회에 실패했어요" }, { status: 502 });
  }
}
