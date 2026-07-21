import type { MetadataRoute } from "next";
import { getRecentSearches } from "@/lib/recent";

const BASE = "https://mmr-lens.kro.kr";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 기록된 소환사 결과 페이지를 색인 대상에 포함 — "닉네임 MMR" 롱테일 검색 유입용
  let summonerPages: MetadataRoute.Sitemap = [];
  try {
    summonerPages = (await getRecentSearches()).map((r) => ({
      url: `${BASE}/summoner/${r.region}/${encodeURIComponent(`${r.gameName}#${r.tagLine}`)}`,
      lastModified: new Date(r.searchedAt),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
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
    ...summonerPages,
  ];
}
