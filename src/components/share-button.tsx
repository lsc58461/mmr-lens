"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// 결과 카드를 서버(/api/share-image)에서 PNG로 받아 공유한다.
// 모바일: 시스템 공유 시트 / PC: 파일 다운로드
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

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "MMR Lens" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("이미지를 다운로드했어요");
      }
    } catch (e) {
      // 공유 시트 취소는 무시
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("이미지 생성에 실패했어요");
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
