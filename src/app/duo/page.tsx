import { Heart } from "lucide-react";
import { PageHeader } from "@/components/page-kit";
import { DuoClient } from "./duo-client";

export const metadata = {
  title: "듀오 궁합 분석",
  description:
    "두 소환사가 함께한 경기의 승률과 기록으로 듀오 궁합을 분석해요",
};

export default function DuoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={Heart}
        title="듀오 궁합 분석"
        description="둘이 같이 하면 이기는 조합일까? 최근 경기로 확인해 보세요"
      />
      <DuoClient />
    </div>
  );
}
