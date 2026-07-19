import { pointsToRank, TIER_COLORS, TIER_LABELS } from "@/lib/mmr/rank";

// 현재 랭크와 추정 MMR을 티어 스펙트럼 위에 마커로 보여주는 판독기 바.
// 서버 컴포넌트 — 순수 HTML/CSS로 렌더된다.
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

  // 두 마커가 모두 보이도록 티어(400pt) 경계에 맞춰 창을 잡는다
  const lo = Math.max(0, Math.floor((Math.min(...pts) - 250) / 400) * 400);
  const hi = Math.ceil((Math.max(...pts) + 250) / 400) * 400;
  const span = hi - lo;
  const pos = (v: number) =>
    ((Math.min(Math.max(v, lo), hi) - lo) / span) * 100;

  const segments: { start: number; tier: string }[] = [];
  for (let p = lo; p < hi; p += 400) {
    segments.push({ start: p, tier: pointsToRank(p).tier });
  }

  return (
    <div className="pt-8 pb-8">
      <div className="relative">
        {/* 추정 마커 (위) */}
        {estimatedPoints !== null && (
          <div
            className="absolute -top-7 z-10 -translate-x-1/2 text-center"
            style={{ left: `${pos(estimatedPoints)}%` }}
          >
            <div className="text-[11px] font-semibold text-chart-2">추정</div>
            <div className="mx-auto h-0 w-0 border-x-4 border-t-6 border-x-transparent border-t-chart-2" />
          </div>
        )}
        {/* 현재 마커 (아래) */}
        {currentPoints !== null && (
          <div
            className="absolute -bottom-7 z-10 -translate-x-1/2 text-center"
            style={{ left: `${pos(currentPoints)}%` }}
          >
            <div className="mx-auto h-0 w-0 border-x-4 border-b-6 border-x-transparent border-b-primary" />
            <div className="text-[11px] font-semibold text-primary">현재</div>
          </div>
        )}

        {/* 티어 스펙트럼 바 — 티어 이름은 바 안에 표시 */}
        <div className="flex h-6 w-full gap-px overflow-hidden rounded-full">
          {segments.map((s) => (
            <div
              key={s.start}
              className="flex h-full flex-1 items-center justify-center opacity-90"
              style={{ backgroundColor: TIER_COLORS[s.tier] }}
            >
              <span className="truncate px-1 text-[10px] font-semibold text-black/60">
                {TIER_LABELS[s.tier]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
