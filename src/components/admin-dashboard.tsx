"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Database,
  History,
  LogOut,
  RefreshCw,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

interface Maintenance {
  active: boolean;
  on: boolean;
  reason: string | null;
  startsAt: string | null;
  endsAt: string | null;
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

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  // 점검 설정
  const [mnt, setMnt] = useState<Maintenance | null>(null);
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/maintenance")
      .then((r) => r.json())
      .then((d: Maintenance) => {
        setMnt(d);
        setReason(d.reason ?? "");
        setStartsAt(isoToLocalInput(d.startsAt));
        setEndsAt(isoToLocalInput(d.endsAt));
      })
      .catch(() => {});
  }, []);

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

  async function saveMaintenance(on: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          on,
          reason: reason || null,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error();
      const data: Maintenance = await res.json();
      setMnt(data);
      toast.success(
        data.on
          ? data.active
            ? "점검 모드가 켜졌어요 — 최대 10초 내 전체 적용"
            : "점검이 예약됐어요 — 시작 시각에 자동 활성화"
          : "점검 모드를 껐어요",
      );
    } catch {
      toast.error("점검 설정 저장에 실패했어요");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  const deepFreshCount =
    status?.summoners.filter((s) => s.analysis === "deep").length ?? 0;
  const mntState = !mnt?.on
    ? { label: "꺼짐", cls: "bg-muted text-muted-foreground" }
    : mnt.active
      ? { label: "점검 중", cls: "bg-destructive text-white" }
      : { label: "예약됨", cls: "bg-chart-2 text-white" };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">관리자</h1>
            <p className="text-xs text-muted-foreground">
              {updatedAt
                ? `5초 자동 갱신 · ${new Date(updatedAt).toLocaleTimeString("ko-KR")}`
                : "불러오는 중…"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
          <LogOut className="size-3.5" />
          로그아웃
        </Button>
      </div>

      {/* 스탯 타일 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Activity}
          label="실행 중 분석"
          value={
            status?.running
              ? `${Math.round(status.running.progress * 100)}%`
              : "—"
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
          value={`${deepFreshCount}/${status?.summoners.length ?? 0}`}
          sub="신선한 정밀 분석 비율"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

      {/* 점검 모드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-primary" />
            점검 모드
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${mntState.cls}`}
            >
              {mntState.label}
            </span>
          </CardTitle>
          <CardDescription>
            사유·기간을 설정하고 켜면 방문자에게 점검 페이지가 표시돼요. 종료
            시각이 지나면 자동으로 해제됩니다. (어드민·API는 점검 중에도 접속
            가능)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="점검 사유 (예: 서버 업그레이드 작업)"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              시작 (비우면 즉시)
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              종료 (비우면 수동 해제까지)
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mnt?.on ? "secondary" : "destructive"}
              disabled={saving}
              onClick={() => saveMaintenance(true)}
            >
              {mnt?.on ? "설정 업데이트" : "점검 켜기"}
            </Button>
            {mnt?.on && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => saveMaintenance(false)}
              >
                점검 끄기
              </Button>
            )}
          </div>
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
            스테일 = 매치 기준 불일치, 구버전 알고리즘 또는 분석 후 72시간 경과
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/60">
            {status?.summoners.map((r) => (
              <div
                key={`${r.region}:${r.name}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm"
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
