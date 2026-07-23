"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    fetch("/api/admin/verified")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Verified[] }) => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">
          인증된 소환사 ({activeCount})
        </h1>
        <p className="text-xs text-muted-foreground">
          디스코드 멤버 인증을 마친 계정 — 승급/강등·연승·시즌최고 알림 대상
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="divide-y divide-border/60">
            {items.map((v) => (
              <div
                key={`${v.platform}:${v.game_name}#${v.tag_line}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={
                      v.active ? "truncate" : "truncate text-muted-foreground line-through"
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
              <p className="py-4 text-center text-sm text-muted-foreground">
                {loaded ? "아직 인증한 소환사가 없어요" : "불러오는 중…"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
