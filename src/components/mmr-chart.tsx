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
  ChartLegend,
  ChartLegendContent,
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
  lobby: { label: "로비 평균 MMR", color: "var(--chart-1)" },
  est: { label: "추정 MMR", color: "var(--chart-2)" },
} satisfies ChartConfig;

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
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <ComposedChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
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
              fill={payload.win ? "var(--color-lobby)" : "var(--destructive)"}
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
          dot={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  );
}
