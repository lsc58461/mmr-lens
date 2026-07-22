import type { MetadataRoute } from "next";
import { cache } from "@/lib/cache";

const BASE = "https://mmr-lens.kro.kr";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // DB에 보관 중(30일)인 분석된 소환사 전체를 색인 대상에 포함 —
  // "닉네임 MMR" 롱테일 검색 유입용. 키 형식: quick:{region}:{이름#태그}
  let summonerPages: MetadataRoute.Sitemap = [];
  try {
    const entries = await cache.entries<{ analyzedAt?: number }>("quick:");
    summonerPages = entries.flatMap((e) => {
      const m = e.key.match(/^quick:([^:]+):(.+)$/);
      if (!m || !m[2].includes("#")) return [];
      return [
        {
          url: `${BASE}/summoner/${m[1]}/${encodeURIComponent(m[2])}`,
          lastModified: e.value.analyzedAt
            ? new Date(e.value.analyzedAt)
            : undefined,
          changeFrequency: "daily" as const,
          priority: 0.7,
        },
      ];
    });
  } catch {
    // 캐시 조회 실패 시 정적 페이지만이라도 반환
  }

  return [
    {
      url: BASE,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/recent`,
      changeFrequency: "hourly",
      priority: 0.6,
    },
    {
      url: `${BASE}/faq`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/updates`,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    ...summonerPages,
  ];
}
