import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, SearchX } from "lucide-react";
import { MmrChart, type MmrChartPoint } from "@/components/mmr-chart";
import { SearchForm } from "@/components/search-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { estimateMmr } from "@/lib/mmr/estimate";
import { TIER_COLORS } from "@/lib/mmr/rank";
import { RiotApiError, PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export const dynamic = "force-dynamic";

const CONFIDENCE_LABELS = {
  high: "신뢰도 높음",
  medium: "신뢰도 보통",
  low: "신뢰도 낮음",
} as const;

function gapVerdict(gap: number): { text: string; tone: "up" | "down" | "flat" } {
  if (gap >= 150)
    return { text: "티어보다 훨씬 높은 실력대에서 매칭되고 있어요. 승급 가도!", tone: "up" };
  if (gap >= 50)
    return { text: "티어보다 한 단계 높은 매칭이에요. LP를 잘 받고 있을 거예요.", tone: "up" };
  if (gap <= -150)
    return { text: "현재 티어보다 낮은 실력대에서 매칭되고 있어요. LP 효율이 나쁠 수 있어요.", tone: "down" };
  if (gap <= -50)
    return { text: "티어보다 약간 낮은 매칭이에요.", tone: "down" };
  return { text: "티어와 실제 MMR이 잘 맞아떨어져요.", tone: "flat" };
}

function ErrorCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <SearchForm compact />
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        홈으로 돌아가기
      </Link>
    </div>
  );
}

export default async function SummonerPage({
  params,
}: {
  params: Promise<{ region: string; riotId: string }>;
}) {
  const { region, riotId } = await params;
  if (!(region in PLATFORM_LABELS)) {
    return <ErrorCard title="지원하지 않는 지역이에요" description="지역을 다시 선택해 주세요." />;
  }
  const decoded = decodeURIComponent(riotId);
  const hashIndex = decoded.lastIndexOf("#");
  if (hashIndex <= 0) {
    return (
      <ErrorCard
        title="잘못된 검색 형식이에요"
        description="게임명#태그 형식으로 검색해 주세요. (예: Hide on bush#KR1)"
      />
    );
  }
  const gameName = decoded.slice(0, hashIndex);
  const tagLine = decoded.slice(hashIndex + 1);

  let result;
  try {
    result = await estimateMmr(region as PlatformRegion, gameName, tagLine);
  } catch (e) {
    if (e instanceof RiotApiError && e.status === 404) {
      return (
        <ErrorCard
          title="소환사를 찾을 수 없어요"
          description={`"${decoded}" 계정이 ${PLATFORM_LABELS[region as PlatformRegion]} 서버에 없어요. 철자와 태그를 확인해 주세요.`}
        />
      );
    }
    if (e instanceof RiotApiError && (e.status === 401 || e.status === 403)) {
      return (
        <ErrorCard
          title="API 키가 만료됐어요"
          description="라이엇 개발용 API 키는 24시간마다 만료돼요. developer.riotgames.com에서 재발급 후 .env.local을 갱신해 주세요."
        />
      );
    }
    throw e;
  }

  const {
    account,
    soloEntry,
    currentRank,
    currentPoints,
    estimatedRank,
    estimatedPoints,
    gap,
    recentWinrate,
    matches,
    sampledPlayers,
    confidence,
  } = result;

  const chartData: MmrChartPoint[] = [...matches]
    .reverse()
    .map((m, i, arr) => ({
      game: i === arr.length - 1 ? "최근" : `${arr.length - 1 - i}경기 전`,
      lobby: m.lobbyPoints !== null ? Math.round(m.lobbyPoints) : null,
      win: m.win,
    }));

  const verdict = gap !== null ? gapVerdict(gap) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {account.gameName}
              <span className="text-muted-foreground">#{account.tagLine}</span>
            </h1>
            <Badge variant="secondary">{PLATFORM_LABELS[region as PlatformRegion]}</Badge>
          </div>
          {soloEntry && (
            <p className="mt-1 text-sm text-muted-foreground">
              시즌 {soloEntry.wins}승 {soloEntry.losses}패 (
              {Math.round((soloEntry.wins / (soloEntry.wins + soloEntry.losses)) * 100)}
              %)
            </p>
          )}
        </div>
        <div className="w-full sm:w-80">
          <SearchForm compact />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>현재 티어</CardDescription>
            <CardTitle
              className="text-xl"
              style={currentRank ? { color: TIER_COLORS[currentRank.tier] } : undefined}
            >
              {currentRank?.label ?? "언랭크"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              추정 MMR
              <Badge variant="outline" className="font-normal">
                {CONFIDENCE_LABELS[confidence]}
              </Badge>
            </CardDescription>
            <CardTitle
              className="text-xl"
              style={estimatedRank ? { color: TIER_COLORS[estimatedRank.tier] } : undefined}
            >
              {estimatedRank?.label ?? "표본 부족"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>티어 대비 판독</CardDescription>
            <CardTitle className="flex items-center gap-1.5 text-xl">
              {verdict?.tone === "up" && <ArrowUp className="size-5 text-emerald-500" />}
              {verdict?.tone === "down" && <ArrowDown className="size-5 text-red-500" />}
              {verdict?.tone === "flat" && <Minus className="size-5 text-muted-foreground" />}
              {gap !== null ? `${gap > 0 ? "+" : ""}${gap}pt` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {verdict && <p className="text-sm text-muted-foreground">{verdict.text}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">경기별 로비 평균 MMR</CardTitle>
          <CardDescription>
            최근 {matches.length}경기에서 만난 플레이어 {sampledPlayers}명의 현재
            랭크 기준 · 점 색상은 승(파랑)/패(빨강)
            {recentWinrate !== null &&
              ` · 최근 승률 ${Math.round(recentWinrate * 100)}%`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.some((d) => d.lobby !== null) ? (
            <MmrChart data={chartData} currentPoints={currentPoints} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              최근 솔로랭크 경기가 없어 그래프를 그릴 수 없어요.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">분석에 사용된 경기</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {matches.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                최근 솔로랭크 기록이 없어요.
              </p>
            )}
            {matches.map((m, i) => (
              <div key={m.matchId}>
                {i > 0 && <Separator className="my-1" />}
                <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={m.win ? "default" : "destructive"}
                      className="w-9 justify-center"
                    >
                      {m.win ? "승" : "패"}
                    </Badge>
                    <span className="font-medium">{m.championName}</span>
                    <span className="text-muted-foreground">{m.kda}</span>
                  </div>
                  <div className="text-right text-muted-foreground">
                    {m.lobbyPoints !== null ? (
                      <>
                        로비 평균{" "}
                        <span className="font-medium text-foreground">
                          {Math.round(m.lobbyPoints)}pt
                        </span>
                        <span className="ml-1 text-xs">({m.sampleSize}명 표본)</span>
                      </>
                    ) : (
                      "표본 없음"
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * 라이엇은 MMR을 공개하지 않으므로 이 수치는 같은 경기에 배정된
        플레이어들의 현재 랭크를 근거로 한 추정치입니다. 표본이 적을수록 오차가
        커질 수 있어요.
      </p>
    </div>
  );
}
