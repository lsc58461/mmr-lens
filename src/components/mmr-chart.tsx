"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { pointsToRank } from "@/lib/mmr/rank";

export interface MmrChartPoint {
  game: string; // "8경기 전" ... "최근"
  lobby: number | null;
  win: boolean;
}

const chartConfig = {
  lobby: { label: "로비 평균 MMR", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function MmrChart({
  data,
  currentPoints,
}: {
  data: MmrChartPoint[];
  currentPoints: number | null;
}) {
  const values = data
    .map((d) => d.lobby)
    .filter((v): v is number => v !== null)
    .concat(currentPoints !== null ? [currentPoints] : []);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(50, (max - min) * 0.2);

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="game" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
          tickFormatter={(v: number) => pointsToRank(v).label.split(" · ")[0]}
          tickLine={false}
          axisLine={false}
          width={78}
          fontSize={11}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span>
                  {pointsToRank(Number(value)).label} ({Math.round(Number(value))}pt)
                </span>
              )}
            />
          }
        />
        <Line
          dataKey="lobby"
          type="monotone"
          stroke="var(--color-lobby)"
          strokeWidth={2}
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
      </LineChart>
    </ChartContainer>
  );
}
