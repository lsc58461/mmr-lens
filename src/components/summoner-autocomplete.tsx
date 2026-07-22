"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { TIER_COLORS } from "@/lib/mmr/rank";

interface Suggestion {
  name: string;
  tag: string;
  label: string | null;
  tier: string | null;
}

// 기록된 소환사 기반 자동완성 인풋 — 포커스/입력 시 DB 기록에서 후보를 보여준다.
// 방향키·엔터로 선택 가능 (엔터는 후보가 하이라이트된 경우에만 가로챈다)
export function SummonerAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchSuggest(q: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/summoners/suggest?region=kr&q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const data: { items: Suggestion[] } = await res.json();
        setItems(data.items);
        setHighlight(-1);
      } catch {
        // 자동완성 실패는 조용히 무시
      }
    }, 200);
  }

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function select(s: Suggestion) {
    onChange(`${s.name}#${s.tag}`);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          fetchSuggest(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          fetchSuggest(value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + items.length) % items.length);
          } else if (e.key === "Enter" && highlight >= 0) {
            e.preventDefault();
            select(items[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {items.map((s, i) => (
            <li key={`${s.name}#${s.tag}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm ${
                  i === highlight ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <span className="min-w-0 truncate">
                  {s.name}
                  <span className="text-muted-foreground">#{s.tag}</span>
                </span>
                {s.label && (
                  <span
                    className="shrink-0 text-xs"
                    style={
                      s.tier ? { color: TIER_COLORS[s.tier] } : undefined
                    }
                  >
                    {s.label}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
