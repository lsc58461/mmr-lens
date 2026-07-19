// Data Dragon(라이엇 정적 에셋 CDN) 헬퍼. API 키 불필요.

import "server-only";
import { cached } from "@/lib/cache";

const FALLBACK_VERSION = "15.1.1";

// match-v5의 championName과 ddragon 파일명이 다른 예외들
const NAME_QUIRKS: Record<string, string> = {
  FiddleSticks: "Fiddlesticks",
};

export async function getDDragonVersion(): Promise<string> {
  try {
    return await cached("ddragon:version", 60 * 60 * 24, async () => {
      const res = await fetch(
        "https://ddragon.leagueoflegends.com/api/versions.json",
        { cache: "no-store", signal: AbortSignal.timeout(5_000) },
      );
      if (!res.ok) throw new Error(`versions.json ${res.status}`);
      const versions: string[] = await res.json();
      return versions[0];
    });
  } catch {
    return FALLBACK_VERSION;
  }
}

export function championIconUrl(version: string, championName: string): string {
  const key = NAME_QUIRKS[championName] ?? championName;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`;
}

export function profileIconUrl(version: string, iconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}

/** 티어 엠블럼 (CommunityDragon 정적 에셋) */
export function tierEmblemUrl(tier: string): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}
