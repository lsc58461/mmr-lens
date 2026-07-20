"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function isIOS(): boolean {
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    // iPadOS 13+는 데스크톱 UA로 위장하므로 터치 지원으로 판별
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// 결과 카드를 서버(/api/share-image)에서 PNG로 받아 공유한다.
// 단계적 폴백: 시스템 공유 시트 → 파일 다운로드 → 새 탭에서 열기(iOS/인앱).
// 주의: fetch를 기다린 뒤에는 user activation이 만료돼 share()가
// NotAllowedError로 실패할 수 있다(특히 iOS) — 실패 시 조용히 다음 단계로 넘어간다.
export function ShareButton({
  region,
  riotId,
}: {
  region: string;
  riotId: string; // "게임명#태그"
}) {
  const [loading, setLoading] = useState(false);

  async function share() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/share-image?region=${region}&riotId=${encodeURIComponent(riotId)}`,
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const file = new File([blob], `${riotId.replace("#", "-")}-mmr.png`, {
        type: "image/png",
      });

      // 1) 시스템 공유 시트
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "MMR Lens" });
          return;
        } catch (e) {
          // 사용자가 시트를 닫은 경우는 종료, 그 외(활성화 만료 등)는 다음 단계로
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      // 다운로드 시작 전에 URL이 해제되지 않도록 지연 해제
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      // 2) 파일 다운로드 (데스크톱/안드로이드)
      if (!isIOS()) {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        toast.success("이미지를 다운로드했어요");
        return;
      }

      // 3) iOS·인앱 브라우저 — blob 다운로드가 안 되므로 새 탭에서 열기
      const win = window.open(url, "_blank");
      if (!win) {
        // 팝업 차단 시 현재 탭에서 열기 (뒤로가기로 복귀 가능)
        location.href = url;
      }
      toast.info("이미지를 길게 눌러 저장하거나 공유하세요");
    } catch {
      toast.error("이미지 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={share}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Share2 className="size-3.5" />
      )}
      이미지 공유
    </Button>
  );
}
