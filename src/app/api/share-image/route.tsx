import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import {
  getFreshDeepResult,
  getFreshQuickResult,
  getLatestMatchId,
  saveQuickResult,
} from "@/lib/mmr/deep-jobs";
import { estimateMmr, type MmrEstimate } from "@/lib/mmr/estimate";
import { TIER_COLORS } from "@/lib/mmr/rank";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";

function gapText(gap: number | null): string {
  if (gap === null) return "";
  if (gap >= 50) return "티어보다 높은 실력대에서 매칭 중";
  if (gap <= -50) return "티어보다 낮은 실력대에서 매칭 중";
  return "티어와 실제 MMR이 일치";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get("region") ?? "";
  const riotId = sp.get("riotId") ?? "";
  const hashIndex = riotId.lastIndexOf("#");
  if (!(region in PLATFORM_LABELS) || hashIndex <= 0) {
    return new Response("invalid params", { status: 400 });
  }
  const platform = region as PlatformRegion;
  const gameName = riotId.slice(0, hashIndex);
  const tagLine = riotId.slice(hashIndex + 1);

  let result: MmrEstimate;
  try {
    const latestMatchId = await getLatestMatchId(platform, gameName, tagLine);
    result =
      (await getFreshDeepResult(platform, gameName, tagLine, latestMatchId)) ??
      (await getFreshQuickResult(platform, gameName, tagLine, latestMatchId)) ??
      (await estimateMmr(platform, gameName, tagLine));
    await saveQuickResult(platform, gameName, tagLine, result);
  } catch {
    return new Response("not found", { status: 404 });
  }

  const [bold, regular] = await Promise.all([
    readFile(path.join(process.cwd(), "src/assets/fonts/Pretendard-Bold.ttf")),
    readFile(
      path.join(process.cwd(), "src/assets/fonts/Pretendard-Regular.ttf"),
    ),
  ]);

  let emblemUri: string | null = null;
  if (result.estimatedRank) {
    try {
      const png = await readFile(
        path.join(
          process.cwd(),
          "public/ranked-emblems",
          `${result.estimatedRank.tier.toLowerCase()}.png`,
        ),
      );
      emblemUri = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      // 엠블럼 없이 렌더
    }
  }

  const estColor = result.estimatedRank
    ? TIER_COLORS[result.estimatedRank.tier]
    : "#8888a0";
  const curColor = result.currentRank
    ? TIER_COLORS[result.currentRank.tier]
    : "#8888a0";

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
          padding: "56px 72px",
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

        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: "4px solid #ffffff",
                }}
              />
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
              MMR{" "}
              <span style={{ color: "#3b82f6", marginLeft: 8 }}>Lens</span>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#71717b" }}>
            {PLATFORM_LABELS[platform]} · 솔로랭크
          </div>
        </div>

        {/* 본문 */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
              {result.account.gameName}
              <span style={{ color: "#71717b", marginLeft: 6 }}>
                #{result.account.tagLine}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: "#a1a1aa",
                marginTop: 10,
              }}
            >
              추정 MMR
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 700,
                color: estColor,
              }}
            >
              {result.estimatedRank?.label ?? "표본 부족"}
            </div>
            {result.estimatedPoints !== null && (
              <div style={{ display: "flex", fontSize: 26, color: "#71717b" }}>
                {Math.round(result.estimatedPoints).toLocaleString()}pt
                {result.errorMargin !== null
                  ? ` · 오차범위 ±${result.errorMargin}pt`
                  : ""}
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: 14,
                fontSize: 28,
              }}
            >
              <span style={{ color: "#a1a1aa" }}>현재 티어</span>
              <span style={{ color: curColor, fontWeight: 700 }}>
                {result.currentRank?.label ?? "언랭크"}
              </span>
              {result.gap !== null && (
                <span
                  style={{
                    color:
                      result.gap >= 50
                        ? "#34d399"
                        : result.gap <= -50
                          ? "#f87171"
                          : "#a1a1aa",
                  }}
                >
                  ({result.gap > 0 ? "+" : ""}
                  {result.gap}pt)
                </span>
              )}
            </div>
          </div>

          {emblemUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emblemUri}
              alt=""
              width={330}
              height={330}
              style={{ objectFit: "contain" }}
            />
          )}
        </div>

        {/* 푸터 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#52525c",
          }}
        >
          <div style={{ display: "flex" }}>{gapText(result.gap)}</div>
          <div style={{ display: "flex" }}>
            최근 경기 로비 랭크 역추적 기반 추정치 · Riot 비공식
          </div>
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
    },
  );
}
