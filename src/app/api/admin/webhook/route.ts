import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import {
  CHANNEL_SETTING_KEY,
  getNotifyChannelId,
  sendNotification,
} from "@/lib/notify";
import { setSetting } from "@/lib/store";

export const dynamic = "force-dynamic";

const SITE = "https://mmr-lens.kro.kr";

export async function GET(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    channelId: (await getNotifyChannelId()) ?? "",
    botReady: Boolean(process.env.DISCORD_BOT_TOKEN),
  });
}

// 채널 저장 { channelId } / 테스트 발송 { test } / 카드 미리보기 { preview }
export async function POST(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { channelId?: string; test?: boolean; preview?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (body.channelId !== undefined) {
    const ch = body.channelId.trim();
    if (ch && !/^\d{5,25}$/.test(ch)) {
      return NextResponse.json(
        { error: "채널 ID는 숫자만 입력해 주세요" },
        { status: 400 },
      );
    }
    await setSetting(CHANNEL_SETTING_KEY, ch);
    return NextResponse.json({ ok: true, channelId: ch });
  }

  if (body.test) {
    const ok = await sendNotification({
      content: "✅ MMR Lens 알림 연결 테스트",
    });
    if (!ok) {
      return NextResponse.json(
        { error: "발송 실패 — 채널 ID·봇 권한을 확인해 주세요" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.preview) {
    const riotId = body.preview.trim().normalize("NFKC");
    const hash = riotId.lastIndexOf("#");
    if (hash <= 0) {
      return NextResponse.json(
        { error: "게임명#태그 형식으로 입력해 주세요" },
        { status: 400 },
      );
    }
    const encoded = encodeURIComponent(riotId);
    const ok = await sendNotification({
      embeds: [
        {
          title: `🎉 ${riotId} 님 승급! (미리보기)`,
          description: "실제 승급/강등·연승·시즌최고 시 이렇게 발송돼요",
          url: `${SITE}/summoner/kr/${encoded}`,
          color: 0x3b82f6,
          image: {
            url: `${SITE}/api/share-image?region=kr&riotId=${encoded}&v=${Date.now()}`,
          },
          footer: { text: "MMR Lens · 추정 MMR로 보는 실력대" },
        },
      ],
    });
    if (!ok) {
      return NextResponse.json(
        { error: "발송 실패 — 채널 ID·봇 권한을 확인해 주세요" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid request" }, { status: 400 });
}
