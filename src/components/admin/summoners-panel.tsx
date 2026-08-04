"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ANALYSIS_BADGES,
  fetchAdminStatus,
  timeAgo,
  type AdminStatus,
} from "./types";
import { EmptyState, PageHeader } from "./ui";

type Analysis = AdminStatus["summoners"][number]["analysis"];

const FILTERS: { key: "all" | Analysis; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "deep", label: "정밀 · 최신" },
  { key: "deep-stale", label: "정밀 · 스테일" },
  { key: "quick", label: "빠른 분석" },
  { key: "quick-stale", label: "빠른 · 스테일" },
  { key: "none", label: "캐시 만료" },
];

export function SummonersPanel() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Analysis>("all");
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    try {
      const d = await fetchAdminStatus();
      if (d) setStatus(d);
    } catch {
      // 무시 — 새로고침 버튼으로 재시도
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchAdminStatus()
      .then((d) => {
        if (!cancelled && d) setStatus(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const all = status?.summoners ?? [];
  const counts = all.reduce<Record<string, number>>((acc, s) => {
    acc[s.analysis] = (acc[s.analysis] ?? 0) + 1;
    return acc;
  }, {});
  const list = all.filter(
    (s) =>
      (filter === "all" || s.analysis === filter) &&
      s.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="기록된 소환사"
        description="스테일 = 매치 기준 불일치, 구버전 알고리즘 또는 분석 후 72시간 경과"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={busy}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="소환사 검색"
            className="pl-9"
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {list.length} / {all.length}명
        </span>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const n = f.key === "all" ? all.length : (counts[f.key] ?? 0);
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {f.label}
              <span className="tabular-nums opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="hidden items-center gap-3 border-b px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:flex">
            <span className="flex-1">소환사</span>
            <span className="w-24 shrink-0">상태</span>
            <span className="w-40 shrink-0 text-right">현재 → 추정</span>
            <span className="w-16 shrink-0 text-right">검색</span>
          </div>
          <div className="divide-y divide-border/60">
            {list.map((r) => (
              <div
                key={`${r.region}:${r.name}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40 sm:flex-nowrap"
              >
                <a
                  href={`/summoner/${r.region}/${encodeURIComponent(r.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-w-0 flex-1 items-center gap-1.5 font-medium"
                >
                  <span className="truncate underline-offset-4 group-hover:underline">
                    {r.name}
                  </span>
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
                <span className="sm:w-24 sm:shrink-0">
                  <Badge
                    variant={ANALYSIS_BADGES[r.analysis].variant}
                    className="text-[10px]"
                  >
                    {ANALYSIS_BADGES[r.analysis].label}
                  </Badge>
                </span>
                <span className="truncate text-xs text-muted-foreground sm:w-40 sm:shrink-0 sm:text-right">
                  {r.currentLabel ?? "언랭"} → {r.estimatedLabel ?? "?"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground sm:w-16 sm:text-right">
                  {timeAgo(r.searchedAt)}
                </span>
              </div>
            ))}
            {list.length === 0 && (
              <EmptyState icon={Users}>
                {status ? "조건에 맞는 소환사가 없어요" : "불러오는 중…"}
              </EmptyState>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
