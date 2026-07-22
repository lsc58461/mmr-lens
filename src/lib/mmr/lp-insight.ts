// LP 득실 추적 — league_snapshots 히스토리에서 연속 스냅샷 간
// 승패·LP 변화를 비교해 "승리당/패배당 평균 LP"를 계산한다.
// LP 득실은 라이엇 내부 MMR을 가장 직접 반영하는 신호다:
// 승리 LP > 패배 LP 면 시스템이 현재 티어보다 높게 평가 중이라는 뜻.

import { rankToPoints } from "./rank";
import type { LeagueSnapRow } from "@/lib/store";

export interface LpInsight {
  avgGain: number | null; // 승리당 평균 +LP (표본 부족 시 null)
  avgLoss: number | null; // 패배당 평균 -LP (양수로 표현)
  observedWins: number; // 관측된 총 승수
  observedLosses: number;
  netPoints: number; // 관측 구간 순 변동(pt)
}

// 한 구간에 게임이 너무 많으면(스냅샷 공백) 노이즈로 보고 제외
const MAX_GAMES_PER_INTERVAL = 10;
// 승당/패당 평균을 표시하려면 최소 이만큼의 "순수 구간" 게임 수 필요
const MIN_GAMES_FOR_AVG = 2;

export function computeLpInsight(rows: LeagueSnapRow[]): LpInsight | null {
  const points = rows
    .filter(
      (r) =>
        r.solo_tier !== null &&
        r.solo_rank !== null &&
        r.solo_lp !== null &&
        r.solo_wins !== null &&
        r.solo_losses !== null,
    )
    .map((r) => ({
      pts: rankToPoints(r.solo_tier!, r.solo_rank!, r.solo_lp!),
      wins: r.solo_wins!,
      losses: r.solo_losses!,
    }));
  if (points.length < 2) return null;

  let gainPts = 0;
  let gainGames = 0;
  let lossPts = 0;
  let lossGames = 0;
  let observedWins = 0;
  let observedLosses = 0;
  let netPoints = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const dW = cur.wins - prev.wins;
    const dL = cur.losses - prev.losses;
    // 시즌 리셋·데이터 역행 구간은 제외
    if (dW < 0 || dL < 0) continue;
    if (dW + dL === 0 || dW + dL > MAX_GAMES_PER_INTERVAL) continue;

    const dPts = cur.pts - prev.pts;
    observedWins += dW;
    observedLosses += dL;
    netPoints += dPts;

    // 순수 구간만 승당/패당 평균에 사용 (혼합 구간은 분해 불가)
    if (dL === 0 && dW > 0 && dPts > 0) {
      gainPts += dPts;
      gainGames += dW;
    } else if (dW === 0 && dL > 0 && dPts < 0) {
      lossPts += -dPts;
      lossGames += dL;
    }
  }

  if (observedWins + observedLosses === 0) return null;

  return {
    avgGain: gainGames >= MIN_GAMES_FOR_AVG ? gainPts / gainGames : null,
    avgLoss: lossGames >= MIN_GAMES_FOR_AVG ? lossPts / lossGames : null,
    observedWins,
    observedLosses,
    netPoints,
  };
}

/** 표시할 만한 정보가 있는지 (카드 노출 여부) */
export function hasLpSignal(insight: LpInsight | null): boolean {
  return insight !== null && (insight.avgGain !== null || insight.avgLoss !== null);
}

export function lpVerdict(insight: LpInsight): {
  text: string;
  tone: "up" | "down" | "flat";
} | null {
  if (insight.avgGain === null || insight.avgLoss === null) return null;
  const diff = insight.avgGain - insight.avgLoss;
  if (diff >= 3) {
    return {
      text: "승리 LP가 패배 LP보다 커요 — 시스템이 현재 티어보다 높게 평가 중이라 상승 여력이 있어요.",
      tone: "up",
    };
  }
  if (diff <= -3) {
    return {
      text: "패배 LP가 승리 LP보다 커요 — 시스템 평가가 현재 티어보다 낮아 LP 효율이 나쁜 구간이에요.",
      tone: "down",
    };
  }
  return {
    text: "승패 LP가 균형이에요 — 현재 티어가 실력과 잘 맞는 상태예요.",
    tone: "flat",
  };
}
