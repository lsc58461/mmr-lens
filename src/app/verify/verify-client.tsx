"use client";

import Image from "next/image";
import { useState } from "react";
import { BadgeCheck, Loader2, RefreshCw, Search } from "lucide-react";
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

export function VerifyClient({ ddVersion }: { ddVersion: string }) {
  const [riotId, setRiotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<{
    iconId: number;
    name: string;
  } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setDone(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "kr", riotId, step: "start" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "요청에 실패했어요");
        return;
      }
      if (data.alreadyVerified) {
        setDone(data.name);
        toast.success("이미 인증된 계정이에요!");
        return;
      }
      setChallenge({ iconId: data.iconId, name: data.name });
    } catch {
      toast.error("요청에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setLoading(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "kr", riotId, step: "confirm" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "확인에 실패했어요");
        if (res.status === 410) setChallenge(null);
        return;
      }
      setDone(data.name);
      setChallenge(null);
      toast.success("인증 완료! 이제 승급/강등 알림을 받아요 🎉");
    } catch {
      toast.error("확인에 실패했어요. 잠시 후 다시 시도해 주세요.");
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
            <br />
            프로필 아이콘은 원래대로 되돌려도 됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="text-base">1. 계정 입력</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} className="flex gap-2">
            <SummonerAutocomplete
              value={riotId}
              onChange={setRiotId}
              placeholder="게임명#태그 (예: Hide on bush#KR1)"
            />
            <Button type="submit" disabled={loading} className="shrink-0 gap-1.5">
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
            <CardTitle className="text-base">2. 프로필 아이콘 변경</CardTitle>
            <CardDescription>
              롤 클라이언트에서 <b>{challenge.name}</b>의 프로필 아이콘을 아래
              아이콘으로 변경한 뒤 확인 버튼을 눌러주세요. (기본 아이콘이라 누구나
              보유 중 · 10분 안에 완료 · 인증 후 원래대로 되돌려도 돼요)
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
              <Button onClick={confirm} disabled={loading} className="gap-1.5">
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
    </div>
  );
}
