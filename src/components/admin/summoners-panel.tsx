"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ANALYSIS_BADGES,
  fetchAdminStatus,
  timeAgo,
  type AdminStatus,
} from "./types";

export function SummonersPanel() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchAdminStatus()
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  const list = (status?.summoners ?? []).filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">기록된 소환사</h1>
        <p className="text-xs text-muted-foreground">
          스테일 = 매치 기준 불일치, 구버전 알고리즘 또는 분석 후 72시간 경과
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="소환사 검색"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent>
          <div className="divide-y divide-border/60">
            {list.map((r) => (
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
            {list.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {status ? "결과가 없어요" : "불러오는 중…"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
