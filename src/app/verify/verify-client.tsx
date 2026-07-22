"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Link2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { SummonerAutocomplete } from "@/components/summoner-autocomplete";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function VerifyClient({
  discordEnabled,
  discordUser,
  discordStatus,
  prefill,
}: {
  discordEnabled: boolean;
  discordUser: string | null;
  discordStatus: string | null;
  prefill: string;
}) {
  const [riotId, setRiotId] = useState(prefill);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (discordStatus === "notmember") {
      toast.error(
        "우리 디스코드 서버 멤버가 아니에요 — 먼저 서버에 가입해 주세요",
      );
    } else if (discordStatus === "error") {
      toast.error("디스코드 인증에 실패했어요. 다시 시도해 주세요.");
    } else if (discordStatus === "unconfigured") {
      toast.error("디스코드 연동이 아직 설정되지 않았어요");
    } else if (discordStatus === "ok") {
      toast.success("디스코드 멤버 확인 완료! 소환사를 연결해 주세요.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "kr", riotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "요청에 실패했어요");
        return;
      }
      setDone(data.name);
      toast.success("인증 완료! 이제 승급/강등 알림을 받아요 🎉");
    } catch {
      toast.error("요청에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card className="overflow-visible">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <BadgeCheck className="size-10 text-emerald-500" />
          <div className="font-semibold">{done} 인증 완료!</div>
          <p className="text-sm text-muted-foreground">
            이제 티어 승급/강등 시 디스코드 알림이 발송돼요.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!discordEnabled) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          디스코드 연동이 아직 준비 중이에요. 잠시 후 다시 시도해 주세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="text-base">1. 디스코드 멤버 확인</CardTitle>
          <CardDescription>
            우리 서버 멤버인지 디스코드 로그인으로 확인해요
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discordUser ? (
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
              <BadgeCheck className="size-4" />
              {discordUser} 님 — 서버 멤버 확인됨
            </div>
          ) : (
            <a
              href="/api/discord/login"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#5865F2] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" />
              디스코드로 인증하기
            </a>
          )}
        </CardContent>
      </Card>

      {discordUser && (
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle className="text-base">2. 내 소환사 연결</CardTitle>
            <CardDescription>
              알림을 받을 본인 롤 계정을 입력해 주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={link} className="flex gap-2">
              <SummonerAutocomplete
                value={riotId}
                onChange={setRiotId}
                placeholder="게임명#태그 (예: Hide on bush#KR1)"
              />
              <Button
                type="submit"
                disabled={loading || !riotId.includes("#")}
                className="shrink-0 gap-1.5"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                연결하기
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
