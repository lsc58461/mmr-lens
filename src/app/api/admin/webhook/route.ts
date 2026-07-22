import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import { WEBHOOK_SETTING_KEY, getWebhookUrl } from "@/lib/notify";
import { setSetting } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ url: (await getWebhookUrl()) ?? "" });
}

// 저장 { url } / 테스트 발송 { test: true }
export async function POST(req: NextRequest) {
  if (!(await isValidAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { url?: string; test?: boolean; preview?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (body.test) {
    const url = await getWebhookUrl();
    if (!url) {
      return NextResponse.json({ error: "웹훅이 설정되지 않았어요" }, { status: 400 });
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "✅ MMR Lens 웹훅 연결 테스트" }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
    if (!res || !res.ok) {
      return NextResponse.json({ error: "발송 실패 — URL을 확인해 주세요" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  // 특정 소환사 카드로 실제 알림 모양 미리보기 (상태는 건드리지 않음)
  if (body.preview) {
    const url = await getWebhookUrl();
    if (!url) {
      return NextResponse.json({ error: "웹훅이 설정되지 않았어요" }, { status: 400 });
    }
    const riotId = body.preview.trim().normalize("NFKC");
    const hash = riotId.lastIndexOf("#");
    if (hash <= 0) {
      return NextResponse.json(
        { error: "게임명#태그 형식으로 입력해 주세요" },
        { status: 400 },
      );
    }
    const encoded = encodeURIComponent(riotId);
    const image = `https://mmr-lens.kro.kr/api/share-image?region=kr&riotId=${encoded}&v=${Date.now()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `🎉 ${riotId} 님 승급! (미리보기)`,
            description: "실제 승급/강등·연승·시즌최고 시 이렇게 발송돼요",
            url: `https://mmr-lens.kro.kr/summoner/kr/${encoded}`,
            color: 0x3b82f6,
            image: { url: image },
            footer: { text: "MMR Lens · 추정 MMR로 보는 실력대" },
          },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    if (!res || !res.ok) {
      return NextResponse.json({ error: "발송 실패 — 계정·URL을 확인해 주세요" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  const url = (body.url ?? "").trim();
  if (url && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
    return NextResponse.json(
      { error: "디스코드 웹훅 URL 형식이 아니에요" },
      { status: 400 },
    );
  }
  await setSetting(WEBHOOK_SETTING_KEY, url);
  return NextResponse.json({ ok: true, url });
}
