import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버리스 번들에 fs.readFile 대상 파일 포함 (Vercel 배포용)
  outputFileTracingIncludes: {
    "/api/share-image": ["./src/assets/fonts/**", "./public/ranked-emblems/**"],
    "/opengraph-image": ["./src/assets/fonts/**", "./public/ranked-emblems/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
        pathname: "/cdn/**",
      },
    ],
  },
};

export default nextConfig;
