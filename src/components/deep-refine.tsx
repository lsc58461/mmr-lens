"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Telescope } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// 빠른 추정(quick)으로 렌더된 페이지에서 정밀 분석을 트리거하고 진행률을 폴링한다.
// 완료되면 router.refresh()로 서버 컴포넌트를 다시 렌더 → 캐시된 정밀 결과가 표시된다.
export function DeepRefine({
  region,
  gameName,
  tagLine,
  mode,
}: {
  region: string;
  gameName: string;
  tagLine: string;
  mode: "quick" | "deep";
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"running" | "done" | "error">("running");

  useEffect(() => {
    if (mode !== "quick") return;
    let stopped = false;
    const qs = new URLSearchParams({ region, gameName, tagLine }).toString();

    async function poll() {
      try {
        const res = await fetch(`/api/deep?${qs}`);
        if (!res.ok) throw new Error();
        const data: { state: "running" | "done" | "error"; progress: number } =
          await res.json();
        if (stopped) return;
        setState(data.state);
        setProgress(data.progress ?? 0);
        if (data.state === "done") {
          router.refresh();
          return;
        }
        if (data.state === "error") return;
      } catch {
        if (stopped) return;
        setState("error");
        return;
      }
      setTimeout(poll, 4000);
    }

    poll();
    return () => {
      stopped = true;
    };
  }, [mode, region, gameName, tagLine, router]);

  if (mode === "deep") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Telescope className="size-3" />
        정밀 분석
      </Badge>
    );
  }
  if (state === "error") return null;
  return (
    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      정밀 분석 중 {Math.round(progress * 100)}% · 완료되면 자동 갱신
    </Badge>
  );
}
