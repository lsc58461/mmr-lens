"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Clock, Database, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAdminStatus, type AdminStatus } from "./types";
import { EmptyState, LiveDot, PageHeader, StatTile } from "./ui";

export function DashboardPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const data = await fetchAdminStatus();
        if (stopped) return;
        if (data === null) {
          router.refresh(); // 세션 만료
          return;
        }
        setStatus(data);
        setUpdatedAt(Date.now());
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

  const total = status?.summoners.length ?? 0;
  const deepFresh =
    status?.summoners.filter((s) => s.analysis === "deep").length ?? 0;
  const running = status?.running;
  const waiting = status?.waiting ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="대시보드"
        description="정밀 분석 러너와 대기열, 기록된 소환사 현황"
        actions={
          <LiveDot
            on={!!updatedAt}
            label={
              updatedAt
                ? new Date(updatedAt).toLocaleTimeString("ko-KR")
                : "연결 중"
            }
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={Activity}
          label="실행 중 분석"
          value={running ? `${Math.round(running.progress * 100)}%` : "유휴"}
          sub={running?.name ?? "러너 대기 중"}
          tone={running ? "primary" : "muted"}
        />
        <StatTile
          icon={Clock}
          label="대기열"
          value={waiting.length}
          sub={waiting.length ? `다음: ${waiting[0].name}` : "대기 없음"}
          tone={waiting.length ? "amber" : "muted"}
        />
        <StatTile
          icon={Users}
          label="기록 소환사"
          value={total}
          sub="최근 검색 기준"
        />
        <StatTile
          icon={Database}
          label="정밀 · 최신"
          value={`${deepFresh}/${total}`}
          sub={total ? `${Math.round((deepFresh / total) * 100)}% 신선` : "—"}
          tone={total && deepFresh === total ? "emerald" : "muted"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              실행 중인 정밀 분석
            </CardTitle>
            <CardDescription>한 번에 1건만 실행돼요 (러너 락)</CardDescription>
          </CardHeader>
          <CardContent>
            {running ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    {running.name}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">
                    {Math.round(running.progress * 100)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${running.progress * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">
                    {running.region}
                  </span>
                  <span className="tabular-nums">
                    {running.updatedAgoSec}초 전 갱신
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState icon={Activity}>실행 중인 분석이 없어요</EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-amber-500" />
              대기열
              {waiting.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {waiting.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              상위 5명은 화면을 나가도 순번이 유지돼요
            </CardDescription>
          </CardHeader>
          <CardContent>
            {waiting.length ? (
              <div className="space-y-1.5">
                {waiting.map((w) => (
                  <div
                    key={`${w.region}:${w.name}`}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums">
                        {w.position}
                      </span>
                      <span className="truncate">{w.name}</span>
                    </span>
                    {w.detached ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] text-muted-foreground"
                      >
                        화면 이탈 · 순번 유지
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {w.lastSeenAgoSec}초 전
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Clock}>대기 중인 분석이 없어요</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        실행 중·대기열은 서버 캐시 기준이며 5초 간격으로 갱신됩니다
      </p>
    </div>
  );
}
