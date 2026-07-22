import { Wrench } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "점검 중",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-24 text-center">
      <LogoMark className="size-14" />
      <div className="space-y-2">
        <h1 className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight">
          <Wrench className="size-5 text-primary" />
          잠시 점검 중이에요
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          더 나은 서비스를 위해 점검을 진행하고 있어요.
          <br />
          잠시 후 다시 방문해 주세요.
        </p>
      </div>
    </div>
  );
}
