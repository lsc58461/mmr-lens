import { Sparkles } from "lucide-react";
import { RecapClient } from "./recap-client";

export const metadata = {
  title: "시즌 결산",
  description:
    "시즌 랭크 판수·승률·최다 챔피언을 한 장의 카드로 — 롤 시즌 결산",
};

export default function RecapPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            시즌 결산
          </h1>
          <p className="text-sm text-muted-foreground">
            올 시즌 나의 롤 여정을 카드 한 장으로
          </p>
        </div>
      </div>
      <RecapClient />
    </div>
  );
}
