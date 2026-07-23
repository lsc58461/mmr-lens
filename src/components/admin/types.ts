export interface AdminStatus {
  running: {
    region: string;
    name: string;
    progress: number;
    state: string;
    updatedAgoSec: number;
  } | null;
  waiting: {
    position: number;
    region: string;
    name: string;
    lastSeenAgoSec: number;
  }[];
  summoners: {
    region: string;
    name: string;
    currentLabel: string | null;
    estimatedLabel: string | null;
    searchedAt: number;
    analysis: "deep" | "deep-stale" | "quick" | "quick-stale" | "none";
  }[];
}

export const ANALYSIS_BADGES: Record<
  AdminStatus["summoners"][number]["analysis"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  deep: { label: "정밀 · 최신", variant: "default" },
  "deep-stale": { label: "정밀 · 스테일", variant: "destructive" },
  quick: { label: "빠른 분석", variant: "secondary" },
  "quick-stale": { label: "빠른 · 스테일", variant: "destructive" },
  none: { label: "캐시 만료", variant: "outline" },
};

export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** 어드민 상태 폴링 훅에서 공용으로 쓰는 fetch */
export async function fetchAdminStatus(): Promise<AdminStatus | null> {
  const res = await fetch("/api/admin/status");
  if (!res.ok) return null;
  return res.json();
}
