import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";
import { WEBHOOK_SETTING_KEY, getWebhookUrl } from "@/lib/notify";
import { listRecentSearches, setSetting } from "@/lib/store";

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
  let body: { url?: string; test?: boolean };
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
    // 샘플 카드 이미지: 최근 검색된 소환사(분석 데이터 보유)의 공유 카드
    const recent = await listRecentSearches(1).catch(() => []);
    const s = recent[0];
    const sampleName = s ? `${s.game_name}#${s.tag_line}` : "Hide on bush#KR1";
    const image = s
      ? `https://mmr-lens.kro.kr/api/share-image?region=${s.platform}&riotId=${encodeURIComponent(sampleName)}&v=${Date.now()}`
      : null;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "✅ MMR Lens 디스코드 연동 완료! 실제 알림은 이렇게 와요 ↓",
        embeds: [
          {
            title: `🎉 ${sampleName} 님 승급!`,
            description: "티어가 오르면 이렇게 카드와 함께 알림이 발송돼요",
            url: "https://mmr-lens.kro.kr",
            color: 0x3b82f6,
            footer: { text: "MMR Lens · 추정 MMR로 보는 실력대 (샘플)" },
            ...(image ? { image: { url: image } } : {}),
          },
        ],
      }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
    if (!res || !res.ok) {
      return NextResponse.json({ error: "발송 실패 — URL을 확인해 주세요" }, { status: 502 });
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
