import { cookies } from "next/headers";
import { BadgeCheck } from "lucide-react";
import {
  DISCORD_SESSION_COOKIE,
  getDiscordSession,
  isDiscordConfigured,
} from "@/lib/discord-auth";
import { VerifyClient } from "./verify-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "소환사 인증",
  description:
    "디스코드 서버 멤버 인증으로 계정을 연결하고 승급/강등 알림을 받아보세요",
  robots: { index: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string; summoner?: string }>;
}) {
  const { discord, summoner } = await searchParams;
  const cookieStore = await cookies();
  const discordUser = await getDiscordSession(
    cookieStore.get(DISCORD_SESSION_COOKIE)?.value,
  ).catch(() => null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <BadgeCheck className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            소환사 인증
          </h1>
          <p className="text-sm text-muted-foreground">
            서버 멤버 인증 후 계정을 연결하면 디스코드 승급/강등 알림을 받아요
          </p>
        </div>
      </div>
      <VerifyClient
        discordEnabled={isDiscordConfigured()}
        discordUser={discordUser?.username ?? null}
        discordStatus={discord ?? null}
        prefill={summoner ? decodeURIComponent(summoner) : ""}
      />
    </div>
  );
}
