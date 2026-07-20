import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://mmr-lens.kro.kr",
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://mmr-lens.kro.kr/recent",
      changeFrequency: "hourly",
      priority: 0.6,
    },
  ];
}
