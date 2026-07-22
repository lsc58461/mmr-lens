import { NextResponse, type NextRequest } from "next/server";
import { DISCORD_SESSION_COOKIE, getDiscordSession } from "@/lib/discord-auth";
import { getAccountByRiotId } from "@/lib/riot/client";
import { insertVerifiedSummoner } from "@/lib/store";
import {
  PLATFORM_LABELS,
  RiotApiError,
  type PlatformRegion,
} from "@/lib/riot/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 소환사 인증 — 디스코드 서버 멤버 확인 후 계정 연결.
export async function POST(req: NextRequest) {
  let body: { region?: string; riotId?: string };
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

  const discord = await getDiscordSession(
    req.cookies.get(DISCORD_SESSION_COOKIE)?.value,
  );
  if (!discord) {
    return NextResponse.json(
      { error: "디스코드 인증이 만료됐어요. 다시 로그인해 주세요." },
      { status: 401 },
    );
  }

  try {
    const account = await getAccountByRiotId(platform, gameName, tagLine);
    await insertVerifiedSummoner(
      platform,
      account.gameName,
      account.tagLine,
      account.puuid,
      discord,
    );
    return NextResponse.json({
      verified: true,
      name: `${account.gameName}#${account.tagLine}`,
      discord: discord.username,
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
