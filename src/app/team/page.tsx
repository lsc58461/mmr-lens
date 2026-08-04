import { Swords } from "lucide-react";
import { PageHeader } from "@/components/page-kit";
import { TeamClient } from "./team-client";

export const metadata = {
  title: "내전 팀 밸런서",
  description:
    "참가자들의 매칭 실력대로 가장 공평한 5:5 팀을 자동으로 나눠주는 내전 도우미",
};

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={Swords}
        title="내전 팀 밸런서"
        description="매칭 실력대 기준으로 가장 공평한 팀을 짜드려요"
      />
      <TeamClient />
    </div>
  );
}
