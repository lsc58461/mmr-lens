"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLATFORM_LABELS, type PlatformRegion } from "@/lib/riot/types";

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [region, setRegion] = useState<PlatformRegion>("kr");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    const hashIndex = trimmed.lastIndexOf("#");
    if (hashIndex <= 0 || hashIndex === trimmed.length - 1) {
      toast.error("게임명#태그 형식으로 입력해 주세요 (예: Hide on bush#KR1)");
      return;
    }
    startTransition(() => {
      router.push(`/summoner/${region}/${encodeURIComponent(trimmed)}`);
    });
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3">
      {!compact && (
        <Tabs value={region} onValueChange={(v) => setRegion(v as PlatformRegion)}>
          <TabsList>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="게임명#태그 (예: Hide on bush#KR1)"
          className={compact ? "h-9" : "h-11 text-base"}
        />
        <Button
          type="submit"
          disabled={isPending}
          className={compact ? "h-9" : "h-11 px-5"}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {!compact && "검색"}
        </Button>
      </div>
    </form>
  );
}
