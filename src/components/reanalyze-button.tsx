"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// 매치 목록 캐시를 우회해 새 경기 여부를 확인하고,
// 변화가 있을 때만 페이지를 리로드해 재분석을 트리거한다.
// 쿨다운(소환사당 60초)은 서버가 관리하고, 여기서는 표시만 한다.
export function ReanalyzeButton({
  region,
  gameName,
  tagLine,
  disabled = false, // 정밀 분석 진행 중일 때 비활성화
}: {
  region: string;
  gameName: string;
  tagLine: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(
      () => setRemaining((r) => Math.max(0, r - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reanalyze() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ region, gameName, tagLine }).toString();
      const res = await fetch(`/api/reanalyze?${qs}`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data: {
        changed: boolean;
        cooldown: number;
        deepRunning?: boolean;
      } = await res.json();
      setRemaining(data.cooldown);
      if (data.deepRunning) {
        toast.info("정밀 분석이 진행 중이에요 — 끝나면 자동으로 반영됩니다.");
      } else if (data.changed) {
        toast.success("새 경기를 발견했어요 — 다시 분석합니다");
        router.refresh();
      } else if (data.cooldown < 60) {
        toast.info(`잠시 후 다시 시도해 주세요 (${data.cooldown}초)`);
      } else {
        toast.info("마지막 분석 이후 새 경기가 없어요. 결과가 최신 상태예요.");
      }
    } catch {
      toast.error("확인에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const cooling = remaining > 0;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={reanalyze}
      disabled={disabled || loading || cooling}
      className="gap-1.5"
    >
      <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
      재분석
      {cooling && <span className="tabular-nums">({remaining}초)</span>}
    </Button>
  );
}
