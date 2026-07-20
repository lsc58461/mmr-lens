"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// 이전(오래된) 분석을 먼저 보여주는 동안 백그라운드 재분석을 트리거하고,
// 신선한 결과가 준비되면 페이지를 새로고침한다 (stale-while-revalidate).
export function StaleRefresh({
  region,
  gameName,
  tagLine,
}: {
  region: string;
  gameName: string;
  tagLine: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    const qs = new URLSearchParams({ region, gameName, tagLine }).toString();

    async function poll() {
      try {
        const res = await fetch(`/api/quick-refresh?${qs}`, { method: "POST" });
        if (!res.ok) throw new Error();
        const data: { fresh: boolean } = await res.json();
        if (stopped) return;
        if (data.fresh) {
          router.refresh();
          return;
        }
      } catch {
        // 일시 오류는 다음 폴링에서 재시도
      }
      if (!stopped) setTimeout(poll, 3000);
    }

    poll();
    return () => {
      stopped = true;
    };
  }, [region, gameName, tagLine, router]);

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-amber-500/40 bg-amber-500/10 font-normal text-amber-600 dark:text-amber-400"
    >
      <Loader2 className="size-3 animate-spin" />
      이전 분석 표시 중 · 재분석이 끝나면 자동 갱신돼요
    </Badge>
  );
}
