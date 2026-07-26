"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Swords } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  championIconUrl,
  itemIconUrl,
  spellIconUrl,
} from "@/lib/ddragon-assets";

interface Player {
  name: string;
  champ: string;
  self?: boolean;
}
interface Game {
  matchId: string;
  gameCreation: number;
  gameDuration: number;
  win: boolean;
  championName: string;
  champLevel: number | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number | null;
  damage: number | null;
  gold: number | null;
  vision: number | null;
  position: string;
  spells: number[];
  items: number[];
  team: Player[];
  enemy: Player[];
}

const POSITION_LABEL: Record<string, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MIDDLE: "미드",
  BOTTOM: "원딜",
  UTILITY: "서폿",
};

function timeAgo(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3_600_000);
  if (h < 1) return "방금 전";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function duration(sec: number): string {
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

export function MatchHistory({
  region,
  riotId,
  ddVersion,
}: {
  region: string;
  riotId: string;
  ddVersion: string;
}) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, riotId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { games: Game[] }) => !stop && setGames(d.games))
      .catch(() => !stop && setError(true));
    return () => {
      stop = true;
    };
  }, [region, riotId]);

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500 fill-mode-backwards">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="size-4 text-primary" />
          최근 전적
        </CardTitle>
        <CardDescription>최근 솔로랭크 경기 기록</CardDescription>
      </CardHeader>
      <CardContent>
        {games === null && !error && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            전적을 불러오는 중…
          </div>
        )}
        {error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            전적을 불러오지 못했어요
          </p>
        )}
        {games?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            최근 솔로랭크 기록이 없어요
          </p>
        )}
        <div className="space-y-2">
          {games?.map((g) => {
            const kda =
              g.deaths > 0
                ? ((g.kills + g.assists) / g.deaths).toFixed(2)
                : "Perfect";
            const csPerMin =
              g.cs !== null ? (g.cs / (g.gameDuration / 60)).toFixed(1) : null;
            return (
              <div
                key={g.matchId}
                className={`overflow-hidden rounded-lg border-l-3 ${
                  g.win
                    ? "border-l-chart-1 bg-chart-1/6"
                    : "border-l-destructive bg-destructive/6"
                }`}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* 챔피언 + 스펠 */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <div className="relative">
                      <Image
                        src={championIconUrl(ddVersion, g.championName)}
                        alt=""
                        width={44}
                        height={44}
                        unoptimized
                        className="rounded-lg"
                      />
                      {g.champLevel !== null && (
                        <span className="absolute -bottom-1 -left-1 rounded bg-background/90 px-1 text-[9px] font-bold tabular-nums">
                          {g.champLevel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {g.spells.map((s, i) => {
                        const url = spellIconUrl(ddVersion, s);
                        return url ? (
                          <Image
                            key={i}
                            src={url}
                            alt=""
                            width={20}
                            height={20}
                            unoptimized
                            className="rounded"
                          />
                        ) : (
                          <div key={i} className="size-5 rounded bg-muted" />
                        );
                      })}
                    </div>
                  </div>

                  {/* KDA */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold ${
                          g.win ? "text-chart-1" : "text-destructive"
                        }`}
                      >
                        {g.win ? "승리" : "패배"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {POSITION_LABEL[g.position] ?? ""} · {timeAgo(g.gameCreation)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm font-medium tabular-nums">
                      {g.kills} / <span className="text-destructive">{g.deaths}</span> /{" "}
                      {g.assists}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {kda} 평점
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {csPerMin && `CS ${g.cs} (${csPerMin}/분)`}
                      {g.damage !== null && ` · 딜 ${g.damage.toLocaleString()}`}
                    </div>
                  </div>

                  {/* 아이템 */}
                  <div className="hidden shrink-0 grid-cols-4 gap-0.5 sm:grid">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const url = itemIconUrl(ddVersion, g.items[i] ?? 0);
                      return url ? (
                        <Image
                          key={i}
                          src={url}
                          alt=""
                          width={22}
                          height={22}
                          unoptimized
                          className="rounded"
                        />
                      ) : (
                        <div key={i} className="size-5.5 rounded bg-muted/60" />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setExpanded(expanded === g.matchId ? null : g.matchId)
                    }
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
                    aria-label="팀 구성 보기"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${
                        expanded === g.matchId ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* 팀 구성 펼치기 */}
                {expanded === g.matchId && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t bg-background/40 px-3 py-2 text-xs">
                    {[g.team, g.enemy].map((side, si) => (
                      <div key={si} className="space-y-1">
                        {side.map((p, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Image
                              src={championIconUrl(ddVersion, p.champ)}
                              alt=""
                              width={18}
                              height={18}
                              unoptimized
                              className="rounded"
                            />
                            <span
                              className={`truncate ${
                                p.self
                                  ? "font-semibold text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {p.name.split("#")[0]}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {games && games.length > 0 && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            {duration(games[0].gameDuration)} · 상세 지표는 분석된 경기부터
            채워져요
          </p>
        )}
      </CardContent>
    </Card>
  );
}
