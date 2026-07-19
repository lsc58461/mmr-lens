import { pointsToRank, TIER_COLORS, TIER_LABELS } from "@/lib/mmr/rank";

// 현재 랭크와 추정 MMR을 레인지 슬라이더 스타일로 보여주는 판독기.
// 디비전(100pt) 단위로 줄무늬가 진 티어 컬러 레일 위에 두 노브가 앉고,
// 두 값 사이 구간은 그라디언트로 채워 갭을 시각화한다. 서버 컴포넌트.
export function MmrScale({
  currentPoints,
  estimatedPoints,
}: {
  currentPoints: number | null;
  estimatedPoints: number | null;
}) {
  const pts = [currentPoints, estimatedPoints].filter(
    (v): v is number => v !== null,
  );
  if (pts.length === 0) return null;

  // 디비전(100pt) 경계에 맞춰 창을 잡는다 — 두 값이 가까워도 구분되도록 세밀하게
  const lo = Math.max(0, Math.floor((Math.min(...pts) - 150) / 100) * 100);
  const hi = Math.ceil((Math.max(...pts) + 150) / 100) * 100;
  const span = hi - lo;
  const pos = (v: number) =>
    ((Math.min(Math.max(v, lo), hi) - lo) / span) * 100;
  // 라벨 칩이 카드 밖으로 나가지 않게 가장자리에서 클램프
  const chipPos = (v: number) => Math.min(Math.max(pos(v), 6), 94);

  // 디비전 세그먼트 (같은 티어 안에서는 명도 줄무늬로 디비전 구분)
  const divisions: { start: number; tier: string; even: boolean }[] = [];
  for (let p = lo; p < hi; p += 100) {
    divisions.push({
      start: p,
      tier: pointsToRank(p).tier,
      even: (p / 100) % 2 === 0,
    });
  }

  // 티어 라벨 행을 위한 티어 스팬 계산
  const tierSpans: { tier: string; startPct: number; widthPct: number }[] = [];
  for (const d of divisions) {
    const last = tierSpans[tierSpans.length - 1];
    const widthPct = (100 / span) * 100;
    if (last && last.tier === d.tier) last.widthPct += widthPct;
    else tierSpans.push({ tier: d.tier, startPct: pos(d.start), widthPct });
  }

  const both = currentPoints !== null && estimatedPoints !== null;
  const gapLeft = both ? Math.min(pos(currentPoints), pos(estimatedPoints)) : 0;
  const gapWidth = both
    ? Math.abs(pos(estimatedPoints) - pos(currentPoints))
    : 0;
  const currentFirst = both && currentPoints <= estimatedPoints;

  return (
    <div className="pt-9 pb-11">
      <div className="relative">
        {/* 추정 라벨 칩 (위) */}
        {estimatedPoints !== null && (
          <div
            className="absolute -top-8 z-20 -translate-x-1/2 rounded-full border border-chart-2/40 bg-chart-2/10 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-chart-2"
            style={{ left: `${chipPos(estimatedPoints)}%` }}
          >
            추정
          </div>
        )}
        {/* 현재 라벨 칩 (아래) */}
        {currentPoints !== null && (
          <div
            className="absolute -bottom-8 z-20 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-primary"
            style={{ left: `${chipPos(currentPoints)}%` }}
          >
            현재
          </div>
        )}

        {/* 레일: 디비전 줄무늬 티어 스펙트럼 */}
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {divisions.map((d) => (
            <div
              key={d.start}
              className={`h-full flex-1 ${
                d.start % 400 === 0 && d.start !== lo
                  ? "border-l border-background/70"
                  : ""
              }`}
              style={{
                backgroundColor: TIER_COLORS[d.tier],
                opacity: d.even ? 0.85 : 0.6,
              }}
            />
          ))}
        </div>

        {/* 현재↔추정 갭 구간 그라디언트 */}
        {both && gapWidth > 0.5 && (
          <div
            className={`absolute inset-y-0 z-10 rounded-full bg-gradient-to-r ${
              currentFirst
                ? "from-primary to-chart-2"
                : "from-chart-2 to-primary"
            }`}
            style={{ left: `${gapLeft}%`, width: `${gapWidth}%` }}
          />
        )}

        {/* 노브 */}
        {estimatedPoints !== null && (
          <div
            className="absolute top-1/2 z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-2 shadow-md ring-2 ring-background"
            style={{ left: `${pos(estimatedPoints)}%` }}
          />
        )}
        {currentPoints !== null && (
          <div
            className="absolute top-1/2 z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-md ring-2 ring-background"
            style={{ left: `${pos(currentPoints)}%` }}
          />
        )}

        {/* 티어 라벨 행 */}
        <div className="relative mt-2 h-4">
          {tierSpans.map(
            (t) =>
              t.widthPct >= 10 && (
                <span
                  key={`${t.tier}-${t.startPct}`}
                  className="absolute truncate text-center text-[10px] text-muted-foreground"
                  style={{ left: `${t.startPct}%`, width: `${t.widthPct}%` }}
                >
                  {TIER_LABELS[t.tier]}
                </span>
              ),
          )}
        </div>
      </div>
    </div>
  );
}
