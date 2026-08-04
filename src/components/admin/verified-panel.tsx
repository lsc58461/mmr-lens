"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatTile } from "./ui";

interface Verified {
  platform: string;
  game_name: string;
  tag_line: string;
  active: boolean;
  discord_username: string | null;
}

export function VerifiedPanel() {
  const [items, setItems] = useState<Verified[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/verified");
      if (res.ok) setItems((await res.json()).items ?? []);
    } catch {
      // 무시
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/verified")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Verified[] }) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(v: Verified) {
    try {
      const res = await fetch("/api/admin/verified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: v.platform,
          gameName: v.game_name,
          tagLine: v.tag_line,
          active: !v.active,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(!v.active ? "알림을 복구했어요" : "알림을 해제했어요");
      load();
    } catch {
      toast.error("변경에 실패했어요");
    }
  }

  const activeCount = items.filter((v) => v.active).length;
  const linked = items.filter((v) => v.discord_username).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="인증된 소환사"
        description="디스코드 멤버 인증을 마친 계정 — 승급/강등·연승·시즌최고 알림 대상"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          icon={BadgeCheck}
          label="알림 대상"
          value={activeCount}
          sub="활성 인증"
          tone={activeCount ? "emerald" : "muted"}
        />
        <StatTile icon={BadgeCheck} label="전체 인증" value={items.length} />
        <StatTile
          icon={BadgeCheck}
          label="디코 연동"
          value={linked}
          sub="알림에서 멘션됨"
        />
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="divide-y divide-border/60">
            {items.map((v) => (
              <div
                key={`${v.platform}:${v.game_name}#${v.tag_line}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      v.active ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`}
                  />
                  <span
                    className={
                      v.active
                        ? "truncate font-medium"
                        : "truncate text-muted-foreground line-through"
                    }
                  >
                    {v.game_name}#{v.tag_line}
                  </span>
                  {v.discord_username && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      @{v.discord_username}
                    </Badge>
                  )}
                </span>
                <Button variant="outline" size="sm" onClick={() => toggle(v)}>
                  {v.active ? "알림 해제" : "복구"}
                </Button>
              </div>
            ))}
            {items.length === 0 && (
              <EmptyState icon={BadgeCheck}>
                {loaded ? "아직 인증한 소환사가 없어요" : "불러오는 중…"}
              </EmptyState>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
