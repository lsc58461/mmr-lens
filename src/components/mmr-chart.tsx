"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useEffect, useState } from "react";
import { pointsToRank, pointsToShortLabel } from "@/lib/mmr/rank";

export interface MmrChartPoint {
  game: string; // "8경기 전" ... "최근"
  lobby: number | null;
  est: number | null; // 그 경기까지 반영한 추정 레이팅
  win: boolean;
}

const chartConfig = {
  lobby: { label: "로비 평균 랭크", color: "var(--chart-1)" },
  est: { label: "매칭 실력대", color: "var(--chart-2)" },
} satisfies ChartConfig;

// 색은 전역 토큰으로 직접 참조한다. ChartContainer가 만드는 --color-lobby /
// --color-est는 컨테이너 안에서만 정의되는 스코프 변수라, 밖에 있는 범례에서
// 쓰면 값이 비어 스와치가 통째로 안 보인다.
const LOBBY_COLOR = "var(--chart-1)";
const EST_COLOR = "var(--chart-2)";
// 패배 점 색. --destructive는 다크모드에서 hue 22로, 매칭 실력대 선(--chart-2,
// hue 58)과 작은 점 크기에서 거의 구분되지 않아 "주황 점이 파란 선에 찍혀 있다"로
// 읽혔다. 확실히 붉은 고정색을 써서 계열을 분리한다.
const LOSS_COLOR = "oklch(0.62 0.23 15)";

export function MmrChart({
  data,
  currentPoints,
}: {
  data: MmrChartPoint[];
  currentPoints: number | null;
}) {
  // 좁은 화면에서는 Y축 라벨을 "플3" 축약형으로 줄여 차트 영역을 넓힌다
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const values = data
    .flatMap((d) => [d.lobby, d.est])
    .filter((v): v is number => v !== null)
    .concat(currentPoints !== null ? [currentPoints] : []);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(50, (max - min) * 0.2);

  return (
    <div className="space-y-3">
    <ChartContainer config={chartConfig} className="h-64 w-full">
      {/* right 여백: 마지막 점(r=4)이 잘리지 않도록 */}
      <ComposedChart data={data} margin={{ left: 8, right: 14, top: 8 }}>
        <defs>
          <linearGradient id="fillLobby" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-lobby)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-lobby)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="game" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
          tickFormatter={(v: number) =>
            compact
              ? pointsToShortLabel(v)
              : pointsToRank(v).label.split(" · ")[0]
          }
          tickLine={false}
          axisLine={false}
          width={compact ? 34 : 78}
          fontSize={11}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span>
                  {chartConfig[name as keyof typeof chartConfig]?.label}:{" "}
                  {pointsToRank(Number(value)).label} (
                  {Math.round(Number(value))}pt)
                </span>
              )}
            />
          }
        />
        {currentPoints !== null && (
          <ReferenceLine
            y={currentPoints}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: "현재 랭크",
              position: "insideTopRight",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
          />
        )}
        <Area
          dataKey="lobby"
          type="monotone"
          stroke="var(--color-lobby)"
          strokeWidth={2}
          fill="url(#fillLobby)"
          connectNulls
          dot={({ cx, cy, payload, index }) => (
            <circle
              key={index}
              cx={cx}
              cy={cy}
              r={4}
              fill={payload.win ? LOBBY_COLOR : LOSS_COLOR}
              stroke="var(--background)"
              strokeWidth={1.5}
            />
          )}
        />
        <Line
          dataKey="est"
          type="monotone"
          stroke="var(--color-est)"
          strokeWidth={2}
          strokeDasharray="6 4"
          connectNulls
          // 점선에도 점을 찍어 이 계열이 자기 마커를 갖게 한다 —
          // 점이 없으면 로비 선의 패배 점이 이 계열 것으로 오인된다.
          // 테두리는 로비 점과 동일하게 배경색으로 둘러 겹칠 때 구분되게 한다
          dot={{
            r: 3,
            fill: EST_COLOR,
            stroke: "var(--background)",
            strokeWidth: 1.5,
          }}
        />
      </ComposedChart>
    </ChartContainer>

      {/* 커스텀 범례 — 선 종류와 점 의미를 같이 설명한다 */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="18"
              y2="4"
              stroke={LOBBY_COLOR}
              strokeWidth="2"
            />
          </svg>
          로비 평균 랭크
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="18"
              y2="4"
              stroke={EST_COLOR}
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </svg>
          매칭 실력대
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/70">로비 점</span>
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-full"
              style={{ background: LOBBY_COLOR }}
            />
            승
          </span>
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-full"
              style={{ background: LOSS_COLOR }}
            />
            패
          </span>
        </span>
      </div>
    </div>
  );
}
