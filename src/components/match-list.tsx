"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIER_COLORS } from "@/lib/mmr/rank";

export interface MatchRow {
  id: string;
  win: boolean;
  iconUrl: string | null;
  champName: string;
  kda: string;
  when: string;
  lobbyLabel: string | null; // "플래티넘 2 · 40LP"
  lobbyTier: string | null;
  sampleSize: number;
}

const COLLAPSED_COUNT = 5;

export function MatchList({ rows }: { rows: MatchRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);
  const hidden = rows.length - COLLAPSED_COUNT;

  return (
    <div>
      <div className="divide-y divide-border/60">
        {visible.map((m) => (
          <div key={m.id} className="flex items-center gap-3 py-2.5">
            <div className="relative shrink-0">
              {m.iconUrl ? (
                <Image
                  src={m.iconUrl}
                  alt={m.champName}
                  width={40}
                  height={40}
                  unoptimized
                  className="rounded-lg"
                />
              ) : (
                <div className="size-10 rounded-lg bg-muted" />
              )}
              <span
                className={`absolute -right-1.5 -bottom-1.5 flex size-4.5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-card ${
                  m.win ? "bg-chart-1" : "bg-destructive"
                }`}
              >
                {m.win ? "승" : "패"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.champName}</div>
              <div className="text-xs text-muted-foreground">
                {m.kda} · {m.when}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {m.lobbyLabel ? (
                <>
                  <div
                    className="text-sm font-medium"
                    style={
                      m.lobbyTier
                        ? { color: TIER_COLORS[m.lobbyTier] }
                        : undefined
                    }
                  >
                    {m.lobbyLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    로비 평균 · {m.sampleSize}명 표본
                  </div>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">표본 없음</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {hidden > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full text-muted-foreground"
        >
          {expanded ? "접기" : `더보기 (${hidden}경기)`}
          <ChevronDown
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </Button>
      )}
    </div>
  );
}
