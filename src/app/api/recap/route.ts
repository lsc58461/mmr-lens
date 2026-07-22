import { NextResponse, type NextRequest } from "next/server";
import { buildRecap } from "@/lib/mmr/recap";
import {
  PLATFORM_LABELS,
  RiotApiError,
  type PlatformRegion,
} from "@/lib/riot/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  try {
    const recap = await buildRecap(
      region as PlatformRegion,
      riotId.slice(0, hash),
      riotId.slice(hash + 1),
    );
    return NextResponse.json(recap);
  } catch (e) {
    if (e instanceof RiotApiError && e.status === 404) {
      return NextResponse.json(
        { error: "계정을 찾을 수 없어요" },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: "조회에 실패했어요" }, { status: 502 });
  }
}
