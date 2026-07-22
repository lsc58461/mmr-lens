import { NextResponse, type NextRequest } from "next/server";
import { cache } from "@/lib/cache";
import { getAccountByRiotId, getSummoner } from "@/lib/riot/client";
import { insertVerifiedSummoner, isVerifiedSummoner } from "@/lib/store";
import {
  PLATFORM_LABELS,
  RiotApiError,
  type PlatformRegion,
} from "@/lib/riot/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 소환사 본인 인증 — 지정된 프로필 아이콘으로 변경했는지 확인하는 방식.
// step=start: 도전 과제(아이콘 번호) 발급 / step=confirm: 변경 확인 후 인증 완료
const CHALLENGE_TTL = 60 * 10; // 10분
const STARTER_ICONS = Array.from({ length: 29 }, (_, i) => i); // 0~28 기본 아이콘

interface Challenge {
  iconId: number;
  puuid: number | string;
}

function challengeKey(platform: string, name: string, tag: string): string {
  return `verify-challenge:${platform}:${name.toLowerCase()}#${tag.toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  let body: { region?: string; riotId?: string; step?: "start" | "confirm" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const region = body.region ?? "kr";
  const riotId = (body.riotId ?? "").trim().normalize("NFKC");
  const hash = riotId.lastIndexOf("#");
  if (!(region in PLATFORM_LABELS) || hash <= 0) {
    return NextResponse.json(
      { error: "게임명#태그 형식으로 입력해 주세요" },
      { status: 400 },
    );
  }
  const platform = region as PlatformRegion;
  const gameName = riotId.slice(0, hash);
  const tagLine = riotId.slice(hash + 1);

  try {
    const account = await getAccountByRiotId(platform, gameName, tagLine);

    if (body.step === "confirm") {
      const key = challengeKey(platform, gameName, tagLine);
      const challenge = await cache.get<Challenge>(key);
      if (!challenge) {
        return NextResponse.json(
          { error: "인증 세션이 만료됐어요. 처음부터 다시 시도해 주세요." },
          { status: 410 },
        );
      }
      const summoner = await getSummoner(platform, account.puuid, true);
      if (summoner.profileIconId !== challenge.iconId) {
        return NextResponse.json(
          {
            error:
              "아직 아이콘 변경이 확인되지 않아요. 클라이언트에서 변경 후 잠시 뒤 다시 눌러주세요.",
          },
          { status: 409 },
        );
      }
      await insertVerifiedSummoner(
        platform,
        account.gameName,
        account.tagLine,
        account.puuid,
      );
      await cache.set(key, null, 1);
      return NextResponse.json({
        verified: true,
        name: `${account.gameName}#${account.tagLine}`,
      });
    }

    // step=start
    if (await isVerifiedSummoner(platform, gameName, tagLine)) {
      return NextResponse.json({
        alreadyVerified: true,
        name: `${account.gameName}#${account.tagLine}`,
      });
    }
    const current = await getSummoner(platform, account.puuid, true);
    const candidates = STARTER_ICONS.filter(
      (i) => i !== current.profileIconId,
    );
    const iconId = candidates[Math.floor(Math.random() * candidates.length)];
    await cache.set<Challenge>(
      challengeKey(platform, gameName, tagLine),
      { iconId, puuid: account.puuid },
      CHALLENGE_TTL,
    );
    return NextResponse.json({
      iconId,
      name: `${account.gameName}#${account.tagLine}`,
      expiresInSec: CHALLENGE_TTL,
    });
  } catch (e) {
    if (e instanceof RiotApiError && e.status === 404) {
      return NextResponse.json(
        { error: "계정을 찾을 수 없어요 — 철자와 태그를 확인해 주세요" },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: "요청에 실패했어요" }, { status: 502 });
  }
}
