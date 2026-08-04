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
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
            <BadgeCheck className="size-8 text-emerald-500" />
          </span>
          <div className="text-lg font-semibold">{done} 인증 완료!</div>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            이제 티어 승급/강등, 5·10연승, 시즌 최고 티어 경신 시 디스코드로
            알림이 발송돼요.
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
    <div className="space-y-4">
      <Step
        n={1}
        title="디스코드 멤버 확인"
        description="우리 서버 멤버인지 디스코드 로그인으로 확인해요"
        done={!!discordUser}
        active={!discordUser}
      >
        {discordUser ? (
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
            <BadgeCheck className="size-4 shrink-0" />
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
      </Step>

      <Step
        n={2}
        title="내 소환사 연결"
        description="알림을 받을 본인 롤 계정을 입력해 주세요"
        done={false}
        active={!!discordUser}
      >
        {discordUser ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">
            1단계를 먼저 완료해 주세요
          </p>
        )}
      </Step>
    </div>
  );
}

/** 번호가 붙은 단계 카드 — 완료/진행 중/대기를 색으로 구분한다 */
function Step({
  n,
  title,
  description,
  done,
  active,
  children,
}: {
  n: number;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={`overflow-visible transition-opacity ${active || done ? "" : "opacity-60"}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              done
                ? "bg-emerald-500 text-white"
                : active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {done ? <BadgeCheck className="size-3.5" /> : n}
          </span>
          {title}
        </CardTitle>
        <CardDescription className="pl-8.5">{description}</CardDescription>
      </CardHeader>
      {/* 본문은 들여쓰지 않는다 — 모바일에서 입력+버튼 한 줄 폭이 아까움 */}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
