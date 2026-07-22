// 디스코드 승급/강등 알림 — 랭크 스냅샷이 갱신될 때 티어·디비전 변화를 감지해
// 웹훅으로 전송한다. DISCORD_WEBHOOK_URL 미설정 시 조용히 비활성.
// 대상: 최근 30일 내 검색된 소환사만 (참가자 표본 전체로 알림이 가면 소음)

import "server-only";
import { TIER_LABELS, rankToPoints } from "./mmr/rank";
import {
  findSummonerByPuuid,
  getSetting,
  isVerifiedSummoner,
} from "./store";
import type { LeagueEntry, PlatformRegion } from "./riot/types";

export const WEBHOOK_SETTING_KEY = "discord-webhook";

export async function getWebhookUrl(): Promise<string | null> {
  const stored = await getSetting<string>(WEBHOOK_SETTING_KEY).catch(() => null);
  return stored || process.env.DISCORD_WEBHOOK_URL || null;
}

interface SoloRank {
  tier: string;
  rank: string;
  lp: number;
}

function soloOf(entries: LeagueEntry[]): SoloRank | null {
  const e = entries.find((x) => x.queueType === "RANKED_SOLO_5x5");
  return e ? { tier: e.tier, rank: e.rank, lp: e.leaguePoints } : null;
}

function label(r: SoloRank): string {
  const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier);
  return apex
    ? `${TIER_LABELS[r.tier]} ${r.lp}LP`
    : `${TIER_LABELS[r.tier]} ${{ IV: 4, III: 3, II: 2, I: 1 }[r.rank as "IV"] ?? r.rank}`;
}

export async function notifyRankChangeIfNeeded(
  fp: string,
  platform: PlatformRegion,
  puuid: string,
  prevSolo: SoloRank | null,
  newEntries: LeagueEntry[],
): Promise<void> {
  if (!prevSolo) return;
  const webhook = await getWebhookUrl();
  if (!webhook) return;
  const next = soloOf(newEntries);
  if (!next) return;
  // 티어 또는 디비전이 바뀐 경우만 (LP 변동만은 소음)
  if (prevSolo.tier === next.tier && prevSolo.rank === next.rank) return;

  const summoner = await findSummonerByPuuid(fp, puuid).catch(() => null);
  if (!summoner) return;
  // 본인 인증(/verify)을 마친 소환사만 알림 대상
  const verified = await isVerifiedSummoner(
    platform,
    summoner.game_name,
    summoner.tag_line,
  ).catch(() => false);
  if (!verified) return;

  const up =
    rankToPoints(next.tier, next.rank, next.lp) >
    rankToPoints(prevSolo.tier, prevSolo.rank, prevSolo.lp);
  const name = `${summoner.game_name}#${summoner.tag_line}`;
  const encoded = encodeURIComponent(name);
  const url = `https://mmr-lens.kro.kr/summoner/${platform}/${encoded}`;
  // 공유 카드 이미지를 임베드에 첨부 (디스코드 프록시 캐시 우회 위해 캐시버스터)
  const image = `https://mmr-lens.kro.kr/api/share-image?region=${platform}&riotId=${encoded}&v=${Date.now()}`;

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: up
            ? `🎉 ${name} 님 승급!`
            : `📉 ${name} 님 강등`,
          description: `**${label(prevSolo)}** → **${label(next)}**`,
          url,
          color: up ? 0x3b82f6 : 0xef4444, // 승급 파랑 / 강등 빨강
          image: { url: image },
          footer: { text: "MMR Lens · 추정 MMR로 보는 실력대" },
        },
      ],
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}
