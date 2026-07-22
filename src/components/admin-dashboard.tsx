"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Clock, History, LogOut, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Status {
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

const ANALYSIS_BADGES: Record<
  Status["summoners"][number]["analysis"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  deep: { label: "정밀 · 최신", variant: "default" },
  "deep-stale": { label: "정밀 · 스테일", variant: "destructive" },
  quick: { label: "빠른 분석", variant: "secondary" },
  "quick-stale": { label: "빠른 · 스테일", variant: "destructive" },
  none: { label: "캐시 만료", variant: "outline" },
};

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function AdminDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch("/api/maintenance")
      .then((r) => r.json())
      .then((d: { on: boolean }) => setMaintenance(d.on))
      .catch(() => {});
  }, []);

  async function toggleMaintenance() {
    setToggling(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: !maintenance }),
      });
      if (!res.ok) throw new Error();
      const data: { on: boolean } = await res.json();
      setMaintenance(data.on);
      toast.success(
        data.on
          ? "점검 모드를 켰어요 — 최대 10초 내 전체 적용됩니다"
          : "점검 모드를 껐어요",
      );
    } catch {
      toast.error("점검 모드 변경에 실패했어요");
    } finally {
      setToggling(false);
    }
  }

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin/status");
        if (res.status === 401) {
          router.refresh();
          return;
        }
        if (res.ok) {
          const data: Status = await res.json();
          if (stopped) return;
          setStatus(data);
          setUpdatedAt(Date.now());
        }
      } catch {
        // 다음 폴링에서 재시도
      }
      if (!stopped) setTimeout(poll, 5000);
    }
    poll();
    return () => {
      stopped = true;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">관리자 대시보드</h1>
          <p className="text-sm text-muted-foreground">
            {updatedAt
              ? `5초마다 자동 갱신 · 마지막 갱신 ${new Date(updatedAt).toLocaleTimeString("ko-KR")}`
              : "불러오는 중…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={maintenance ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMaintenance}
            disabled={toggling}
            className="gap-1.5"
          >
            <Wrench className="size-3.5" />
            {maintenance ? "점검 모드 끄기" : "점검 모드 켜기"}
          </Button>
          <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
            <LogOut className="size-3.5" />
            로그아웃
          </Button>
        </div>
      </div>

      {/* 실행 중 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-primary" />
            실행 중인 정밀 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status?.running ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{status.running.name}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {Math.round(status.running.progress * 100)}% ·{" "}
                  {status.running.updatedAgoSec}초 전 갱신
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${status.running.progress * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              실행 중인 분석이 없어요
            </p>
          )}
        </CardContent>
      </Card>

      {/* 대기열 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-chart-2" />
            대기열 ({status?.waiting.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status?.waiting.length ? (
            <div className="space-y-1.5">
              {status.waiting.map((w) => (
                <div
                  key={`${w.region}:${w.name}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="tabular-nums">
                      {w.position}
                    </Badge>
                    {w.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    생존신호 {w.lastSeenAgoSec}초 전
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">대기 중인 분석이 없어요</p>
          )}
        </CardContent>
      </Card>

      {/* 기록된 소환사 전체 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-muted-foreground" />
            기록된 소환사 ({status?.summoners.length ?? 0})
          </CardTitle>
          <CardDescription>
            최근 검색 기록 전체 · 스테일 = 매치 기준 불일치, 구버전 알고리즘
            또는 분석 후 72시간 경과 (저장 데이터 간 비교 기준)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/60">
            {status?.summoners.map((r) => (
              <div
                key={`${r.region}:${r.name}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <a
                    href={`/summoner/${r.region}/${encodeURIComponent(r.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium underline-offset-4 hover:underline"
                  >
                    {r.name}
                  </a>
                  <Badge
                    variant={ANALYSIS_BADGES[r.analysis].variant}
                    className="shrink-0 text-[10px]"
                  >
                    {ANALYSIS_BADGES[r.analysis].label}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.currentLabel ?? "언랭"} → {r.estimatedLabel ?? "?"} ·{" "}
                  {timeAgo(r.searchedAt)}
                </span>
              </div>
            ))}
            {!status?.summoners.length && (
              <p className="py-2 text-sm text-muted-foreground">기록 없음</p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3" />
        실행 중/대기열은 서버 캐시 기준이며 5초 간격으로 갱신됩니다
      </p>
    </div>
  );
}
