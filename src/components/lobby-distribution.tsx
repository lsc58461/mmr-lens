import type { MatchSample } from "@/lib/mmr/estimate";
import {
  pointsToRank,
  rankToPoints,
  TIER_COLORS,
  TIER_LABELS,
} from "@/lib/mmr/rank";

// 경기별 로비 평균 랭크가 어느 티어에 몇 판 분포하는지 보여주는 가로 바 차트.
// 서버 컴포넌트 — 순수 HTML/CSS.
export function LobbyDistribution({ matches }: { matches: MatchSample[] }) {
  const buckets = new Map<string, number>();
  let total = 0;
  for (const m of matches) {
    if (m.lobbyPoints === null) continue;
    const tier = pointsToRank(Math.round(m.lobbyPoints)).tier;
    buckets.set(tier, (buckets.get(tier) ?? 0) + 1);
    total++;
  }
  if (total === 0) return null;

  const entries = [...buckets.entries()].sort(
    (a, b) => rankToPoints(b[0], "IV", 0) - rankToPoints(a[0], "IV", 0),
  );
  const max = Math.max(...entries.map(([, n]) => n));

  return (
    <div className="space-y-2">
      {entries.map(([tier, count]) => (
        <div
          key={tier}
          className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-3 text-sm"
        >
          <span
            className="truncate text-right font-medium"
            style={{ color: TIER_COLORS[tier] }}
          >
            {TIER_LABELS[tier]}
          </span>
          <div className="h-4 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(count / max) * 100}%`,
                backgroundColor: TIER_COLORS[tier],
                opacity: 0.85,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {count}경기 ({Math.round((count / total) * 100)}%)
          </span>
        </div>
      ))}
    </div>
  );
}
