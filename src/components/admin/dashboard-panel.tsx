"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Clock, Database, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAdminStatus, type AdminStatus } from "./types";

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`size-3.5 ${accent ? "text-primary" : ""}`} />
        {label}
      </div>
      <div className="mt-1.5 text-xl font-bold tabular-nums">{value}</div>
      {sub && (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

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

  const deepFresh =
    status?.summoners.filter((s) => s.analysis === "deep").length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">대시보드</h1>
        <p className="text-xs text-muted-foreground">
          {updatedAt
            ? `5초 자동 갱신 · ${new Date(updatedAt).toLocaleTimeString("ko-KR")}`
            : "불러오는 중…"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Activity}
          label="실행 중 분석"
          value={
            status?.running ? `${Math.round(status.running.progress * 100)}%` : "—"
          }
          sub={status?.running?.name ?? "없음"}
          accent={!!status?.running}
        />
        <StatTile
          icon={Clock}
          label="대기열"
          value={status?.waiting.length ?? 0}
          sub="정밀 분석 대기"
        />
        <StatTile
          icon={Users}
          label="기록 소환사"
          value={status?.summoners.length ?? 0}
          sub="최근 검색 기준"
        />
        <StatTile
          icon={Database}
          label="정밀 · 최신"
          value={`${deepFresh}/${status?.summoners.length ?? 0}`}
          sub="신선한 정밀 분석"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
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
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {status.running.updatedAgoSec}초 전 갱신
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${status.running.progress * 100}%` }}
                  />
                </div>
                <div className="text-right text-xs text-muted-foreground tabular-nums">
                  {Math.round(status.running.progress * 100)}%
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                실행 중인 분석이 없어요
              </p>
            )}
          </CardContent>
        </Card>

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
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {w.position}
                      </Badge>
                      <span className="truncate">{w.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {w.lastSeenAgoSec}초 전
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                대기 중인 분석이 없어요
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3" />
        실행 중·대기열은 서버 캐시 기준이며 5초 간격으로 갱신됩니다
      </p>
    </div>
  );
}
