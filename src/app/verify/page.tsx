import { BadgeCheck } from "lucide-react";
import { getDDragonVersion } from "@/lib/ddragon";
import { VerifyClient } from "./verify-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "소환사 인증",
  description:
    "프로필 아이콘 변경 방식으로 계정을 인증하고 디스코드 승급/강등 알림을 받아보세요",
};

export default async function VerifyPage() {
  const ddVersion = await getDDragonVersion();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <BadgeCheck className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            소환사 인증
          </h1>
          <p className="text-sm text-muted-foreground">
            내 계정임을 인증하면 디스코드 승급/강등 알림을 받아요
          </p>
        </div>
      </div>
      <VerifyClient ddVersion={ddVersion} />
    </div>
  );
}
