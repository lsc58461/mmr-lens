"use client";

import { useState } from "react";
import { ImageDown, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SummonerAutocomplete } from "@/components/summoner-autocomplete";
import { TIER_COLORS } from "@/lib/mmr/rank";

interface Recap {
  name: string;
  totalRanked: number;
  totalCapped: boolean;
  analyzed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  topChamps: { championName: string; games: number; wins: number }[];
  peakRank: { tier: string; label: string } | null;
  currentRank: { tier: string; label: string } | null;
}

export function RecapClient() {
  const [riotId, setRiotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);

  async function load(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRecap(null);
    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "kr", riotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "조회에 실패했어요");
        return;
      }
      setRecap(data);
    } catch {
      toast.error("조회에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const winrate =
    recap && recap.analyzed > 0
      ? Math.round((recap.wins / recap.analyzed) * 100)
      : null;
  const kda =
    recap && recap.deaths > 0
      ? ((recap.kills + recap.assists) / recap.deaths).toFixed(2)
      : recap && recap.analyzed > 0
        ? "∞"
        : null;
  const imageUrl = recap
    ? `/api/recap-image?region=kr&riotId=${encodeURIComponent(recap.name)}`
    : "";

  return (
    <div className="space-y-5">
      {/* overflow-visible: 자동완성 드롭다운이 카드 밖으로 나올 수 있게 */}
      <Card className="overflow-visible">
        <CardContent>
          <form onSubmit={load} className="flex gap-2">
            <SummonerAutocomplete
              value={riotId}
              onChange={setRiotId}
              placeholder="게임명#태그 (예: Hide on bush#KR1)"
            />
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              결산 보기
            </Button>
          </form>
        </CardContent>
      </Card>

      {recap && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-chart-2" />
                {recap.name}의 시즌 결산
              </CardTitle>
              <CardDescription>
                시즌 랭크 {recap.totalRanked}
                {recap.totalCapped ? "+" : ""}판 · 상세 통계는 분석된{" "}
                {recap.analyzed}경기 기준
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">시즌 랭크</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {recap.totalRanked}
                    {recap.totalCapped ? "+" : ""}판
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">분석 승률</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {winrate !== null ? `${winrate}%` : "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">KDA</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {kda ?? "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">
                    관측 최고 랭크
                  </div>
                  <div
                    className="mt-1 truncate text-lg font-bold"
                    style={
                      recap.peakRank
                        ? { color: TIER_COLORS[recap.peakRank.tier] }
                        : undefined
                    }
                  >
                    {recap.peakRank?.label ?? "수집 중"}
                  </div>
                </div>
              </div>

              {recap.topChamps.length > 0 && (
                <div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    최다 플레이 챔피언
                  </div>
                  <div className="space-y-1.5">
                    {recap.topChamps.map((c) => (
                      <div
                        key={c.championName}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{c.championName}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {c.games}판 {Math.round((c.wins / c.games) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ImageDown className="size-3.5" />
                결산 카드 이미지로 보기
              </a>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            * 상세 통계는 MMR Lens가 분석하며 저장한 경기 기준이라, 검색·재분석이
            반복될수록 더 정확해져요.
          </p>
        </>
      )}
    </div>
  );
}
