import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getRecentSearches } from "@/lib/recent";
import { TIER_COLORS } from "@/lib/mmr/rank";
import { PLATFORM_LABELS } from "@/lib/riot/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "최근 검색 — MMR Lens" };

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default async function RecentPage() {
  const entries = await getRecentSearches();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <History className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">최근 검색</h1>
          <p className="text-sm text-muted-foreground">
            최근 조회된 소환사 {entries.length}명
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            아직 검색 기록이 없어요. 홈에서 소환사를 검색해 보세요.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Link
              key={`${e.region}:${e.gameName}#${e.tagLine}`}
              href={`/summoner/${e.region}/${encodeURIComponent(`${e.gameName}#${e.tagLine}`)}`}
              className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate font-semibold">
                    {e.gameName}
                    <span className="font-normal text-muted-foreground">
                      #{e.tagLine}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {PLATFORM_LABELS[e.region]}
                  </Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {timeAgo(e.searchedAt)}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 text-right text-xs sm:gap-5 sm:text-sm">
                <div>
                  <div className="text-[10px] text-muted-foreground">티어</div>
                  <div
                    className="font-medium"
                    style={
                      e.currentTier
                        ? { color: TIER_COLORS[e.currentTier] }
                        : undefined
                    }
                  >
                    {e.currentLabel ?? "언랭크"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">
                    추정 MMR
                  </div>
                  <div
                    className="font-medium"
                    style={
                      e.estimatedTier
                        ? { color: TIER_COLORS[e.estimatedTier] }
                        : undefined
                    }
                  >
                    {e.estimatedLabel ?? "표본 부족"}
                    {e.estimatedPoints !== null && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
                        {Math.round(e.estimatedPoints).toLocaleString()}pt
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
