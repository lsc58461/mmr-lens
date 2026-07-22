"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
} from "lucide-react";
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
  ddVersion,
  discordEnabled,
  discordUser,
  discordStatus,
}: {
  ddVersion: string;
  discordEnabled: boolean;
  discordUser: string | null;
  discordStatus: string | null;
}) {
  const [riotId, setRiotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<{
    iconId: number;
    name: string;
  } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // 디스코드가 설정돼 있으면 기본은 디스코드 방식
  const [mode, setMode] = useState<"discord" | "icon">(
    discordEnabled ? "discord" : "icon",
  );

  useEffect(() => {
    if (discordStatus === "notmember") {
      toast.error("우리 디스코드 서버 멤버가 아니에요 — 먼저 서버에 가입해 주세요");
    } else if (discordStatus === "error") {
      toast.error("디스코드 인증에 실패했어요. 다시 시도해 주세요.");
    } else if (discordStatus === "unconfigured") {
      toast.error("디스코드 연동이 아직 설정되지 않았어요");
    } else if (discordStatus === "ok") {
      toast.success("디스코드 멤버 확인 완료! 소환사를 연결해 주세요.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callVerify(step: "start" | "confirm" | "link") {
    setLoading(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "kr", riotId, step }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "요청에 실패했어요");
        if (res.status === 410) setChallenge(null);
        return;
      }
      if (data.alreadyVerified || data.verified) {
        setDone(data.name);
        setChallenge(null);
        toast.success(
          data.alreadyVerified
            ? "이미 인증된 계정이에요!"
            : "인증 완료! 이제 승급/강등 알림을 받아요 🎉",
        );
        return;
      }
      if (data.iconId !== undefined) {
        setChallenge({ iconId: data.iconId, name: data.name });
      }
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

  return (
    <div className="space-y-5">
      {mode === "discord" ? (
        <>
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    callVerify("link");
                  }}
                  className="flex gap-2"
                >
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

          <button
            type="button"
            onClick={() => setMode("icon")}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            디스코드 계정이 없나요? 프로필 아이콘 방식으로 인증하기
          </button>
        </>
      ) : (
        <>
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-base">1. 계정 입력</CardTitle>
              <CardDescription>
                지정된 프로필 아이콘으로 변경해 계정 소유를 증명하는 방식이에요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  callVerify("start");
                }}
                className="flex gap-2"
              >
                <SummonerAutocomplete
                  value={riotId}
                  onChange={setRiotId}
                  placeholder="게임명#태그 (예: Hide on bush#KR1)"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 gap-1.5"
                >
                  {loading && !challenge ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  시작
                </Button>
              </form>
            </CardContent>
          </Card>

          {challenge && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  2. 프로필 아이콘 변경
                </CardTitle>
                <CardDescription>
                  롤 클라이언트에서 <b>{challenge.name}</b>의 프로필 아이콘을
                  아래 아이콘으로 변경한 뒤 확인 버튼을 눌러주세요. (기본
                  아이콘이라 누구나 보유 중 · 10분 안에 완료 · 인증 후 원래대로
                  되돌려도 돼요)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <Image
                  src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${challenge.iconId}.png`}
                  alt={`아이콘 ${challenge.iconId}번`}
                  width={80}
                  height={80}
                  unoptimized
                  className="rounded-xl ring-2 ring-primary"
                />
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    아이콘 {challenge.iconId}번으로 변경
                  </div>
                  <Button
                    onClick={() => callVerify("confirm")}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    변경했어요, 확인해 주세요
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {discordEnabled && (
            <button
              type="button"
              onClick={() => setMode("discord")}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              ← 디스코드 인증으로 돌아가기
            </button>
          )}
        </>
      )}
    </div>
  );
}
