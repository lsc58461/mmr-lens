"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { PageHeader } from "./ui";

export function NotificationsPanel() {
  const [channelId, setChannelId] = useState("");
  const [botReady, setBotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    fetch("/api/admin/webhook")
      .then((r) => r.json())
      .then((d: { channelId?: string; botReady?: boolean }) => {
        setChannelId(d.channelId ?? "");
        setBotReady(Boolean(d.botReady));
      })
      .catch(() => {});
  }, []);

  async function post(body: object, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="디스코드 알림"
        description="인증된 소환사의 승급/강등·연승·시즌최고 시 Rift Lens 봇이 알림을 보내요"
        actions={
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
              botReady
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${botReady ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {botReady ? "봇 연결됨" : "봇 토큰 미설정"}
          </span>
        }
      />

      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="text-base">알림 채널</CardTitle>
          <CardDescription>
            디스코드 개발자 모드를 켜고 채널 우클릭 → ID 복사로 얻을 수 있어요.
            봇이 해당 채널에 메시지를 보낼 권한이 있어야 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="알림 채널 ID (숫자)"
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                post(
                  { channelId },
                  channelId ? "채널을 저장했어요" : "채널을 비웠어요",
                )
              }
              className="shrink-0"
            >
              저장
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !channelId}
              onClick={() => post({ test: true }, "테스트 메시지를 보냈어요")}
              className="shrink-0"
            >
              테스트
            </Button>
          </div>

          <div className="border-t pt-3">
            <div className="mb-2 text-xs text-muted-foreground">
              특정 계정 카드로 실제 알림 모양 미리보기
            </div>
            <div className="flex gap-2">
              <SummonerAutocomplete
                value={preview}
                onChange={setPreview}
                placeholder="게임명#태그"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !preview.includes("#")}
                onClick={() => post({ preview }, "미리보기를 보냈어요")}
                className="shrink-0"
              >
                미리보기
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
