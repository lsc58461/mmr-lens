import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  SearchX,
  TrendingUp,
  Users,
} from "lucide-react";
import { DeepRefine } from "@/components/deep-refine";
import { LobbyDistribution } from "@/components/lobby-distribution";
import { MatchList, type MatchRow } from "@/components/match-list";
import { MmrChart, type MmrChartPoint } from "@/components/mmr-chart";
import { SearchForm } from "@/components/search-form";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  championIconUrl,
  championNameKo,
  getChampionNamesKo,
  getDDragonVersion,
  profileIconUrl,
  tierEmblemUrl,
} from "@/lib/ddragon";
import {
  getFreshDeepResult,
  getFreshQuickResult,
  getLatestMatchId,
  saveQuickResult,
} from "@/lib/mmr/deep-jobs";
import { estimateMmr } from "@/lib/mmr/estimate";
import { pointsToRank, TIER_COLORS } from "@/lib/mmr/rank";
import { recordSearch } from "@/lib/recent";
import { getAccountByRiotId, getSummoner } from "@/lib/riot/client";
import {
  RiotApiError,
  PLATFORM_LABELS,
  type PlatformRegion,
} from "@/lib/riot/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; riotId: string }>;
}) {
  const { region, riotId } = await params;
  const decoded = decodeURIComponent(riotId);
  const title = `${decoded} 숨겨진 MMR — MMR Lens`;
  const image = `/api/share-image?region=${region}&riotId=${encodeURIComponent(decoded)}`;
  return {
    title,
    openGraph: {
      title,
      description: "최근 경기 로비 랭크 역추적으로 추정한 숨겨진 MMR",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

const CONFIDENCE_LABELS = {
  high: "신뢰도 높음",
  medium: "신뢰도 보통",
  low: "신뢰도 낮음",
} as const;

function gapVerdict(gap: number): {
  text: string;
  tone: "up" | "down" | "flat";
} {
  if (gap >= 150)
    return {
      text: "티어보다 훨씬 높은 실력대에서 매칭되고 있어요. 승급 가도!",
      tone: "up",
    };
  if (gap >= 50)
    return {
      text: "티어보다 한 단계 높은 매칭이에요. LP를 잘 받고 있을 거예요.",
      tone: "up",
    };
  if (gap <= -150)
    return {
      text: "현재 티어보다 낮은 실력대에서 매칭되고 있어요. LP 효율이 나쁠 수 있어요.",
      tone: "down",
    };
  if (gap <= -50)
    return { text: "티어보다 약간 낮은 매칭이에요.", tone: "down" };
  return { text: "티어와 실제 MMR이 잘 맞아떨어져요.", tone: "flat" };
}

function timeAgo(ts: number): string {
  const hours = Math.floor((Date.now() - ts) / 3_600_000);
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function WinrateRing({ pct, games }: { pct: number; games: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <div className="relative size-13">
        <svg viewBox="0 0 48 48" className="size-full -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            strokeWidth="5"
            className="stroke-muted"
          />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            stroke="var(--chart-1)"
            strokeDasharray={`${c * pct} ${c}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground">최근 {games}판</span>
    </div>
  );
}

function ErrorCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <SearchForm compact />
      <Link
        href="/"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
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
    return (
      <ErrorCard
        title="지원하지 않는 지역이에요"
        description="지역을 다시 선택해 주세요."
      />
    );
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

  // 최신 매치 ID가 그대로면 저장된 분석(정밀 우선)을 재사용하고,
  // 새 경기가 생겼을 때만 다시 분석한다.
  const platform = region as PlatformRegion;
  let result;
  let mode: "quick" | "deep" = "quick";
  try {
    const latestMatchId = await getLatestMatchId(platform, gameName, tagLine);
    const deep = await getFreshDeepResult(
      platform,
      gameName,
      tagLine,
      latestMatchId,
    );
    if (deep) {
      result = deep;
      mode = "deep";
    } else {
      result = await getFreshQuickResult(
        platform,
        gameName,
        tagLine,
        latestMatchId,
      );
      if (!result) {
        result = await estimateMmr(platform, gameName, tagLine);
        await saveQuickResult(platform, gameName, tagLine, result);
      }
    }
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

  const ddVersion = await getDDragonVersion();
  const champNames = await getChampionNamesKo(ddVersion);

  // 저장된 이전 분석에는 프로필 정보가 없을 수 있어 보충 조회 (둘 다 캐시됨)
  let profileIconId = result.profileIconId ?? null;
  let summonerLevel = result.summonerLevel ?? null;
  if (profileIconId === null) {
    try {
      const acct = await getAccountByRiotId(platform, gameName, tagLine);
      const summoner = await getSummoner(platform, acct.puuid);
      profileIconId = summoner.profileIconId;
      summonerLevel = summoner.summonerLevel;
    } catch {
      // 프로필 조회 실패는 표시 생략으로 처리
    }
  }

  await recordSearch({
    region: platform,
    gameName: result.account.gameName,
    tagLine: result.account.tagLine,
    currentLabel: result.currentRank?.label ?? null,
    currentTier: result.currentRank?.tier ?? null,
    estimatedLabel: result.estimatedRank?.label ?? null,
    estimatedTier: result.estimatedRank?.tier ?? null,
    estimatedPoints: result.estimatedPoints,
  });

  const {
    account,
    soloEntry,
    currentRank,
    currentPoints,
    estimatedRank,
    estimatedPoints,
    errorMargin,
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
      est: m.ratingAfter,
      win: m.win,
    }));

  const verdict = gap !== null ? gapVerdict(gap) : null;
  const estColor = estimatedRank ? TIER_COLORS[estimatedRank.tier] : undefined;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center gap-3">
          {profileIconId !== null && (
            <div className="relative shrink-0">
              <Image
                src={profileIconUrl(ddVersion, profileIconId)}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="rounded-xl ring-2 ring-border"
              />
              {summonerLevel !== null && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border bg-background/95 px-1.5 text-[10px] font-medium tabular-nums">
                  {summonerLevel}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {account.gameName}
              <span className="font-normal text-muted-foreground">
                #{account.tagLine}
              </span>
            </h1>
            <Badge variant="secondary">
              {PLATFORM_LABELS[region as PlatformRegion]}
            </Badge>
            <DeepRefine
              region={region}
              gameName={gameName}
              tagLine={tagLine}
              mode={mode}
            />
            <ShareButton region={region} riotId={decoded} />
          </div>
        </div>
        <div className="w-full sm:w-80">
          <SearchForm compact />
        </div>
      </div>

      {/* 히어로: 추정 MMR 쇼케이스 + 현재 티어 */}
      <div className="grid gap-4 lg:grid-cols-5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-backwards">
        <Card
          className="relative overflow-hidden lg:col-span-3"
          style={
            estColor
              ? {
                  backgroundImage: `radial-gradient(120% 150% at 0% 0%, color-mix(in oklab, ${estColor} 18%, transparent), transparent 60%)`,
                }
              : undefined
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <CardDescription className="flex flex-wrap items-center gap-2">
                  추정 MMR
                  <Badge
                    variant="outline"
                    className="bg-background/60 font-normal"
                  >
                    {CONFIDENCE_LABELS[confidence]}
                  </Badge>
                </CardDescription>
                <CardTitle
                  className="text-2xl sm:text-3xl"
                  style={{ color: estColor }}
                >
                  {estimatedRank?.label ?? "표본 부족"}
                </CardTitle>
                {estimatedPoints !== null && (
                  <p className="text-sm text-muted-foreground">
                    {Math.round(estimatedPoints).toLocaleString()}pt
                    {errorMargin !== null && ` · 오차범위 ±${errorMargin}pt`}
                  </p>
                )}
              </div>
              {estimatedRank && (
                <div className="relative size-22 shrink-0 sm:size-30">
                  <Image
                    src={tierEmblemUrl(estimatedRank.tier)}
                    alt=""
                    fill
                    unoptimized
                    className="object-contain drop-shadow-xl"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          {verdict && (
            <CardContent>
              <div className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2.5 text-xs backdrop-blur-sm sm:text-sm">
                {verdict.tone === "up" && (
                  <ArrowUp className="size-4 shrink-0 text-emerald-500" />
                )}
                {verdict.tone === "down" && (
                  <ArrowDown className="size-4 shrink-0 text-red-500" />
                )}
                {verdict.tone === "flat" && (
                  <Minus className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span>{verdict.text}</span>
                {gap !== null && (
                  <span className="ml-auto shrink-0 font-semibold tabular-nums">
                    {gap > 0 ? "+" : ""}
                    {gap}pt
                  </span>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardDescription>현재 티어</CardDescription>
                <CardTitle
                  className="text-xl sm:text-2xl"
                  style={
                    currentRank
                      ? { color: TIER_COLORS[currentRank.tier] }
                      : undefined
                  }
                >
                  {currentRank?.label ?? "언랭크"}
                </CardTitle>
              </div>
              {recentWinrate !== null && matches.length > 0 && (
                <WinrateRing pct={recentWinrate} games={matches.length} />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {soloEntry && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="size-4" />
                시즌 {soloEntry.wins}승 {soloEntry.losses}패 (
                {Math.round(
                  (soloEntry.wins / (soloEntry.wins + soloEntry.losses)) * 100,
                )}
                %)
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4" />
              표본 {sampledPlayers}명의 현재 랭크 분석
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 로비 티어 분포 */}
      {matches.some((m) => m.lobbyPoints !== null) && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-backwards">
          <CardHeader>
            <CardTitle className="text-base">로비 티어 분포</CardTitle>
            <CardDescription>
              최근 경기들의 로비 평균 랭크가 속한 티어
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LobbyDistribution matches={matches} />
          </CardContent>
        </Card>
      )}

      {/* 추이 차트 */}
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-backwards">
        <CardHeader>
          <CardTitle className="text-base">경기별 MMR 추이</CardTitle>
          <CardDescription>
            최근 {matches.length}경기(리메이크 제외) 기준
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

      {/* 매치 리스트 */}
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[400ms] fill-mode-backwards">
        <CardHeader>
          <CardTitle className="text-base">분석에 사용된 경기</CardTitle>
          <CardDescription>최근 솔로랭크 {matches.length}경기</CardDescription>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              최근 솔로랭크 기록이 없어요.
            </p>
          ) : (
            <MatchList
              rows={matches.map((m): MatchRow => {
                const lobby =
                  m.lobbyPoints !== null
                    ? pointsToRank(Math.round(m.lobbyPoints))
                    : null;
                return {
                  id: m.matchId,
                  win: m.win,
                  iconUrl: m.championName
                    ? championIconUrl(ddVersion, m.championName)
                    : null,
                  champName: championNameKo(champNames, m.championName),
                  kda: m.kda,
                  when: timeAgo(m.gameCreation),
                  lobbyLabel: lobby?.label ?? null,
                  lobbyTier: lobby?.tier ?? null,
                  sampleSize: m.sampleSize,
                };
              })}
            />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * 라이엇은 MMR을 공개하지 않으므로 이 수치는 같은 경기에 배정된
        플레이어들의 현재 랭크(로비별 최고/최저 제외 절사평균)와 승패 성과(Elo
        업데이트)를 결합한 추정치입니다. 표본이 적을수록 오차가 커질 수 있어요.
      </p>
    </div>
  );
}
