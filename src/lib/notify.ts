// 디스코드 마일스톤 알림 — 정밀분석(유저 트리거) 완료 시점에만 호출된다.
// (새벽 크론의 정밀분석은 호출하지 않아 알림이 안 나간다)
// 인증된 소환사의 마지막 알림 상태와 비교해 승급/강등·시즌 최고·연승을 감지한다.
// 상태를 스냅샷이 아니라 verified_summoners에 저장하므로, 크론이 스냅샷을
// 갱신해도 승급을 놓치지 않는다(다음 유저 방문 때 감지).

import "server-only";
import { TIER_LABELS, rankToPoints } from "./mmr/rank";
import {
  getSetting,
  getVerifiedNotifyState,
  updateVerifiedNotifyState,
} from "./store";
import type { PlatformRegion } from "./riot/types";

export const CHANNEL_SETTING_KEY = "discord-channel";
const STREAK_MILESTONE = 5; // 5연승 단위로 알림 (5·10·15…)

export async function getNotifyChannelId(): Promise<string | null> {
  return getSetting<string>(CHANNEL_SETTING_KEY).catch(() => null);
}

export interface DiscordPayload {
  content?: string;
  embeds?: Embed[];
}

/** 알림 전송 — MMR Lens 봇이 지정된 채널로 발송한다 */
export async function sendNotification(
  payload: DiscordPayload,
): Promise<boolean> {
  const channelId = await getNotifyChannelId();
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !botToken) return false;
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    },
  ).catch(() => null);
  return Boolean(res?.ok);
}

export interface SoloRank {
  tier: string;
  rank: string;
  lp: number;
}

function divNum(rank: string): string {
  return { IV: "4", III: "3", II: "2", I: "1" }[rank] ?? rank;
}

/** SoloRank → 표시 라벨 */
function label(r: SoloRank): string {
  const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier);
  return apex
    ? `${TIER_LABELS[r.tier]} ${r.lp}LP`
    : `${TIER_LABELS[r.tier]} ${divNum(r.rank)}`;
}

/** 이전 상태(티어/디비전/포인트)만으로 라벨 — LP는 포인트에서 역산 */
function labelFromState(tier: string, rank: string, points: number): string {
  const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier);
  return apex
    ? `${TIER_LABELS[tier]} ${Math.max(0, points - 2800)}LP`
    : `${TIER_LABELS[tier]} ${divNum(rank)}`;
}

interface Embed {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  image?: { url: string };
  footer?: { text: string };
}

async function send(e: Embed, url: string, image: string): Promise<void> {
  await sendNotification({
    embeds: [
      {
        title: e.title,
        description: e.description,
        url,
        color: e.color,
        image: { url: image },
        footer: { text: "MMR Lens · 추정 MMR로 보는 실력대" },
      },
    ],
  }).catch(() => {});
}

/**
 * 인증된 소환사의 마일스톤(승급/강등·시즌 최고·연승)을 감지해 알림.
 * @param solo 현재 솔로랭크 (언랭이면 null)
 * @param streak 최근 연승(+)/연패(-)
 */
export async function checkMilestones(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  solo: SoloRank | null,
  streak: number,
): Promise<void> {
  if (!solo) return;
  const state = await getVerifiedNotifyState(platform, gameName, tagLine).catch(
    () => null,
  );
  if (!state) return; // 미인증/비활성

  const points = rankToPoints(solo.tier, solo.rank, solo.lp);
  const name = `${gameName}#${tagLine}`;
  const encoded = encodeURIComponent(name);
  const url = `https://mmr-lens.kro.kr/summoner/${platform}/${encoded}`;
  const image = `https://mmr-lens.kro.kr/api/share-image?region=${platform}&riotId=${encoded}&v=${Date.now()}`;

  const events: Embed[] = [];
  const first = state.last_tier === null;
  const isBest = state.best_points === null || points > state.best_points;

  if (!first) {
    const prevPoints = state.last_points ?? 0;
    const changed =
      state.last_tier !== solo.tier || state.last_rank !== solo.rank;
    if (changed) {
      const prev = labelFromState(state.last_tier!, state.last_rank!, prevPoints);
      const now = label(solo);
      if (points > prevPoints) {
        events.push({
          title: isBest
            ? `🏆 ${name} 님 시즌 최고 달성! (${now})`
            : `🎉 ${name} 님 승급!`,
          description: `**${prev}** → **${now}**`,
          color: 0x3b82f6,
        });
      } else {
        events.push({
          title: `📉 ${name} 님 강등`,
          description: `**${prev}** → **${now}**`,
          color: 0xef4444,
        });
      }
    } else if (isBest && points > prevPoints) {
      // 같은 티어·디비전에서 시즌 최고 경신 (마스터+ LP 상승 등)
      events.push({
        title: `🏆 ${name} 님 시즌 최고 갱신!`,
        description: `**${label(solo)}**`,
        color: 0xfbbf24,
      });
    }
    // 연승 마일스톤 (5·10·15… 도달마다 1회)
    if (
      streak >= STREAK_MILESTONE &&
      Math.floor(streak / STREAK_MILESTONE) >
        Math.floor(state.notified_streak / STREAK_MILESTONE)
    ) {
      events.push({
        title: `🔥 ${name} 님 ${streak}연승 중!`,
        description: "무서운 상승세예요. 지금이 점수 올릴 타이밍!",
        color: 0xf59e0b,
      });
    }
  }

  // 상태 갱신 (첫 관측이면 알림 없이 기준선만 저장)
  await updateVerifiedNotifyState(platform, gameName, tagLine, {
    last_tier: solo.tier,
    last_rank: solo.rank,
    last_points: points,
    best_points: Math.max(state.best_points ?? 0, points),
    notified_streak: streak > 0 ? streak : 0,
  }).catch(() => {});

  if (events.length === 0) return;
  for (const e of events) await send(e, url, image);
}
