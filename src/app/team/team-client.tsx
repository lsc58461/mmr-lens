"use client";

import { useMemo, useState } from "react";
import { Copy, Loader2, Plus, Shuffle, Swords, Users, X } from "lucide-react";
import { toast } from "sonner";
import { SummonerAutocomplete } from "@/components/summoner-autocomplete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TIER_COLORS } from "@/lib/mmr/rank";

interface Player {
  input: string;
  name: string;
  points: number;
  label: string;
  tier: string;
  source: "analysis" | "rank" | "unranked";
  error?: string;
}

const SOURCE_LABELS = {
  analysis: "추정 MMR",
  rank: "현재 랭크",
  unranked: "기본값",
} as const;

/** n명의 인덱스를 절반으로 나누는 모든 조합을 팀 점수차 오름차순으로 반환 */
function partitions(players: Player[]): { a: number[]; b: number[]; diff: number }[] {
  const n = players.length;
  const half = Math.floor(n / 2);
  const result: { a: number[]; b: number[]; diff: number }[] = [];
  const seen = new Set<string>();

  const combo = (start: number, picked: number[]) => {
    if (picked.length === half) {
      // 첫 플레이어 고정으로 대칭 중복 제거
      if (n % 2 === 0 && !picked.includes(0)) return;
      const a = picked;
      const b = [...Array(n).keys()].filter((i) => !picked.includes(i));
      const key = a.join(",");
      if (seen.has(key)) return;
      seen.add(key);
      const sumA = a.reduce((s, i) => s + players[i].points, 0);
      const sumB = b.reduce((s, i) => s + players[i].points, 0);
      result.push({ a, b, diff: Math.abs(sumA - sumB) });
      return;
    }
    for (let i = start; i < n; i++) combo(i + 1, [...picked, i]);
  };
  combo(0, []);
  return result.sort((x, y) => x.diff - y.diff);
}

export function TeamClient() {
  const [names, setNames] = useState<string[]>(["", ""]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [comboIndex, setComboIndex] = useState(0);

  const valid = players.filter((p) => !p.error);
  const combos = useMemo(() => partitions(valid), [valid]);
  const current = combos[comboIndex % Math.max(combos.length, 1)];

  function setName(i: number, v: string) {
    setNames((arr) => arr.map((n, idx) => (idx === i ? v : n)));
  }
  function addRow() {
    setNames((arr) => (arr.length >= 10 ? arr : [...arr, ""]));
  }
  function removeRow(i: number) {
    setNames((arr) => (arr.length <= 2 ? arr : arr.filter((_, idx) => idx !== i)));
  }

  async function resolve() {
    const list = names.map((s) => s.trim()).filter(Boolean);
    if (list.length < 2) {
      toast.error("2명 이상 입력해 주세요 (게임명#태그)");
      return;
    }
    if (list.length % 2 !== 0) {
      toast.error("짝수 인원만 팀을 나눌 수 있어요");
      return;
    }
    if (new Set(list.map((s) => s.toLowerCase())).size !== list.length) {
      toast.error("중복된 소환사가 있어요");
      return;
    }
    setLoading(true);
    setComboIndex(0);
    try {
      const res = await fetch("/api/team/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "kr", names: list }),
      });
      if (!res.ok) throw new Error();
      const data: { players: Player[] } = await res.json();
      setPlayers(data.players);
      const failed = data.players.filter((p) => p.error);
      if (failed.length) {
        toast.warning(`${failed.length}명 조회 실패 — 목록에서 확인해 주세요`);
      }
    } catch {
      toast.error("조회에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  function copyTeams() {
    if (!current) return;
    const line = (idx: number[]) =>
      idx.map((i) => `${valid[i].name} (${valid[i].label})`).join("\n");
    const sumA = current.a.reduce((s, i) => s + valid[i].points, 0);
    const sumB = current.b.reduce((s, i) => s + valid[i].points, 0);
    navigator.clipboard
      .writeText(
        `[블루팀] 합계 ${sumA.toLocaleString()}pt\n${line(current.a)}\n\n[레드팀] 합계 ${sumB.toLocaleString()}pt\n${line(current.b)}\n\n전력차 ${current.diff.toLocaleString()}pt · MMR Lens 팀 밸런서`,
      )
      .then(() => toast.success("팀 구성을 복사했어요"))
      .catch(() => toast.error("복사에 실패했어요"));
  }

  const teamCard = (title: string, idx: number[], color: string) => {
    const sum = idx.reduce((s, i) => s + valid[i].points, 0);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span style={{ color }}>{title}</span>
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              합계 {sum.toLocaleString()}pt
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {idx.map((i) => (
            <div
              key={valid[i].name}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate font-medium">
                {valid[i].name}
              </span>
              <span
                className="shrink-0 text-xs"
                style={{ color: TIER_COLORS[valid[i].tier] }}
              >
                {valid[i].label}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      {/* overflow-visible: 자동완성 드롭다운이 카드 밖으로 나올 수 있게 */}
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            참가자 입력
          </CardTitle>
          <CardDescription>
            게임명#태그로 입력 (2·4·6·8·10명) · 실력 점수는 저장된 추정 MMR →
            현재 랭크 순으로 사용해요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {names.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <SummonerAutocomplete
                  value={n}
                  onChange={(v) => setName(i, v)}
                  placeholder={`참가자 ${i + 1} (게임명#태그)`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(i)}
                  disabled={names.length <= 2}
                  aria-label="참가자 제거"
                  className="shrink-0"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={names.length >= 10}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              인원 추가 ({names.length}/10)
            </Button>
            <Button size="sm" onClick={resolve} disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Swords className="size-3.5" />
              )}
              팀 나누기
            </Button>
          </div>
        </CardContent>
      </Card>

      {players.some((p) => p.error) && (
        <Card>
          <CardContent className="space-y-1 text-sm text-destructive">
            {players
              .filter((p) => p.error)
              .map((p) => (
                <div key={p.input}>
                  {p.input} — {p.error}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {current && valid.length >= 2 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary" className="tabular-nums">
              전력차 {current.diff.toLocaleString()}pt · 조합{" "}
              {(comboIndex % combos.length) + 1}/{combos.length}
            </Badge>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComboIndex((i) => i + 1)}
                className="gap-1.5"
              >
                <Shuffle className="size-3.5" />
                다른 조합
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyTeams}
                className="gap-1.5"
              >
                <Copy className="size-3.5" />
                복사
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {teamCard("블루팀", current.a, "#3b82f6")}
            {teamCard("레드팀", current.b, "#ef4444")}
          </div>
          <p className="text-xs text-muted-foreground">
            * 점수 출처:{" "}
            {valid
              .map((p) => `${p.name.split("#")[0]}(${SOURCE_LABELS[p.source]})`)
              .join(" · ")}
          </p>
        </>
      )}
    </div>
  );
}
