import { Heart } from "lucide-react";
import { DuoClient } from "./duo-client";

export const metadata = {
  title: "듀오 궁합 분석",
  description:
    "두 소환사가 함께한 경기의 승률과 기록으로 듀오 궁합을 분석해요",
};

export default function DuoPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Heart className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            듀오 궁합 분석
          </h1>
          <p className="text-sm text-muted-foreground">
            둘이 같이 하면 이기는 조합일까? 최근 경기로 확인해 보세요
          </p>
        </div>
      </div>
      <DuoClient />
    </div>
  );
}
