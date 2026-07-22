"use client";

import { useState } from "react";
import { Heart, Loader2, Search, Swords } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SummonerAutocomplete } from "@/components/summoner-autocomplete";

interface DuoResult {
  a: { name: string };
  b: { name: string };
  totalCommon: number;
  together: { games: number; wins: number };
  versus: { games: number; aWins: number };
  games: {
    matchId: string;
    gameCreation: number;
    sameTeam: boolean;
    win: boolean;
    champA: string;
    champB: string;
  }[];
}

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "오늘";
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function verdictText(games: number, wins: number): string {
  const rate = (wins / games) * 100;
  if (rate >= 60) return "환상의 듀오예요! 같이 하면 이깁니다 💙";
  if (rate >= 50) return "안정적인 조합이에요 — 같이 해도 좋아요";
  if (rate >= 40) return "미묘한 궁합… 컨디션 좋은 날만 같이 하세요";
  return "이 조합은 위험해요. 각자 솔로큐가 나을지도…";
}

export function DuoClient() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DuoResult | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/duo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "kr", a, b }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "조회에 실패했어요");
        return;
      }
      setResult(data);
      if (data.totalCommon === 0) {
        toast.info("최근 100경기 안에서 함께한 기록이 없어요");
      }
    } catch {
      toast.error("조회에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const t = result?.together;
  const winrate = t && t.games > 0 ? Math.round((t.wins / t.games) * 100) : null;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <form onSubmit={analyze} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummonerAutocomplete
                value={a}
                onChange={setA}
                placeholder="첫 번째 소환사 (게임명#태그)"
              />
              <SummonerAutocomplete
                value={b}
                onChange={setB}
                placeholder="두 번째 소환사 (게임명#태그)"
              />
            </div>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              궁합 분석
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Heart className="size-3.5 text-primary" />
                함께 플레이
              </div>
              <div className="mt-1.5 text-xl font-bold tabular-nums">
                {t?.games ?? 0}판
                {t && t.games > 0 && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    {t.wins}승 {t.games - t.wins}패
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">함께 승률</div>
              <div
                className={`mt-1.5 text-xl font-bold tabular-nums ${
                  winrate === null
                    ? ""
                    : winrate >= 50
                      ? "text-emerald-500"
                      : "text-red-500"
                }`}
              >
                {winrate !== null ? `${winrate}%` : "—"}
              </div>
            </div>
            <div className="col-span-2 rounded-xl border bg-card p-4 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Swords className="size-3.5 text-chart-2" />
                맞대결
              </div>
              <div className="mt-1.5 text-xl font-bold tabular-nums">
                {result.versus.games}판
                {result.versus.games > 0 && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    {result.a.name.split("#")[0]} {result.versus.aWins}승
                  </span>
                )}
              </div>
            </div>
          </div>

          {t && t.games > 0 && (
            <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm font-medium">
              {verdictText(t.games, t.wins)}
            </div>
          )}

          {result.games.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">함께 잡힌 경기</CardTitle>
                <CardDescription>
                  최근 100경기 교집합 {result.totalCommon}건 중{" "}
                  {result.games.length}건 표시
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/60">
                {result.games.map((g) => (
                  <div
                    key={g.matchId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Badge
                        variant={g.sameTeam ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {g.sameTeam ? "같은 팀" : "맞대결"}
                      </Badge>
                      <span
                        className={`text-xs font-semibold ${
                          g.win ? "text-chart-1" : "text-destructive"
                        }`}
                      >
                        {g.sameTeam
                          ? g.win
                            ? "승리"
                            : "패배"
                          : g.win
                            ? `${result.a.name.split("#")[0]} 승`
                            : `${result.b.name.split("#")[0]} 승`}
                      </span>
                      <span className="text-muted-foreground">
                        {g.champA} · {g.champB}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(g.gameCreation)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
