import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getChampionNamesKo, getDDragonVersion, championNameKo } from "@/lib/ddragon";
import { buildRecap } from "@/lib/mmr/recap";
import { TIER_COLORS } from "@/lib/mmr/rank";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get("region") ?? "";
  const riotId = (sp.get("riotId") ?? "").normalize("NFKC");
  const hash = riotId.lastIndexOf("#");
  if (!(region in PLATFORM_LABELS) || hash <= 0) {
    return new Response("invalid params", { status: 400 });
  }

  let recap;
  try {
    recap = await buildRecap(
      region as PlatformRegion,
      riotId.slice(0, hash),
      riotId.slice(hash + 1),
    );
  } catch {
    return new Response("not found", { status: 404 });
  }

  const [bold, regular] = await Promise.all([
    readFile(path.join(process.cwd(), "src/assets/fonts/Pretendard-Bold.ttf")),
    readFile(
      path.join(process.cwd(), "src/assets/fonts/Pretendard-Regular.ttf"),
    ),
  ]);
  const ddVersion = await getDDragonVersion();
  const champNames = await getChampionNamesKo(ddVersion);

  let emblemUri: string | null = null;
  if (recap.peakRank) {
    try {
      const png = await readFile(
        path.join(
          process.cwd(),
          "public/ranked-emblems",
          `${recap.peakRank.tier.toLowerCase()}.png`,
        ),
      );
      emblemUri = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      // 엠블럼 없이 렌더
    }
  }

  const winrate =
    recap.analyzed > 0 ? Math.round((recap.wins / recap.analyzed) * 100) : 0;
  const kda =
    recap.deaths > 0
      ? ((recap.kills + recap.assists) / recap.deaths).toFixed(2)
      : "∞";
  const peakColor = recap.peakRank
    ? TIER_COLORS[recap.peakRank.tier]
    : "#8888a0";

  const stat = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", fontSize: 22, color: "#71717b" }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#09090b",
          color: "#fafafa",
          padding: "52px 68px",
          fontFamily: "Pretendard",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -260,
            left: 340,
            width: 700,
            height: 560,
            display: "flex",
            background:
              "radial-gradient(circle, rgba(59,130,246,0.28), rgba(59,130,246,0) 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
            MMR <span style={{ color: "#3b82f6", marginLeft: 6 }}>Lens</span>
            <span style={{ color: "#71717b", marginLeft: 14, fontWeight: 400 }}>
              시즌 결산
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#71717b" }}>
            {PLATFORM_LABELS[region as PlatformRegion]} · 솔로랭크
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <div style={{ display: "flex", fontSize: 46, fontWeight: 700 }}>
              {recap.name.split("#")[0]}
              <span style={{ color: "#71717b" }}>
                #{recap.name.split("#")[1]}
              </span>
            </div>
            <div style={{ display: "flex", gap: 48 }}>
              {stat(
                "시즌 랭크",
                `${recap.totalRanked}${recap.totalCapped ? "+" : ""}판`,
              )}
              {stat("분석 승률", `${winrate}%`)}
              {stat("KDA", kda)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 22, color: "#71717b" }}>
                최다 플레이 챔피언
              </div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
                {recap.topChamps.length
                  ? recap.topChamps
                      .map(
                        (c) =>
                          `${championNameKo(champNames, c.championName)} ${c.games}판`,
                      )
                      .join(" · ")
                  : "데이터 수집 중"}
              </div>
            </div>
            {recap.peakRank && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26 }}>
                <span style={{ color: "#71717b" }}>관측 최고 랭크</span>
                <span style={{ color: peakColor, fontWeight: 700 }}>
                  {recap.peakRank.label}
                </span>
              </div>
            )}
          </div>

          {emblemUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emblemUri}
              alt=""
              width={300}
              height={300}
              style={{ objectFit: "contain" }}
            />
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#52525c",
          }}
        >
          <div style={{ display: "flex" }}>
            상세 통계는 분석된 {recap.analyzed}경기 기준
          </div>
          <div style={{ display: "flex" }}>mmr-lens.kro.kr · Riot 비공식</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700 },
        { name: "Pretendard", data: regular, weight: 400 },
      ],
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
