import { Swords } from "lucide-react";
import { TeamClient } from "./team-client";

export const metadata = {
  title: "내전 팀 밸런서",
  description:
    "참가자들의 추정 MMR로 가장 공평한 5:5 팀을 자동으로 나눠주는 내전 도우미",
};

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Swords className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            내전 팀 밸런서
          </h1>
          <p className="text-sm text-muted-foreground">
            추정 MMR 기준으로 가장 공평한 팀을 짜드려요
          </p>
        </div>
      </div>
      <TeamClient />
    </div>
  );
}
