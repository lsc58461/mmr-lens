import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-36" />
          </CardContent>
        </Card>
      </div>

      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />

      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        최근 경기 참가자들의 랭크를 수집하는 중이에요… 첫 분석은 몇 초 정도
        걸릴 수 있어요.
      </div>
    </div>
  );
}
