import { cookies } from "next/headers";
import { BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/page-kit";
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={BadgeCheck}
        title="소환사 인증"
        description="서버 멤버 인증 후 계정을 연결하면 디스코드 승급/강등 알림을 받아요"
      />
      <VerifyClient
        discordEnabled={isDiscordConfigured()}
        discordUser={discordUser?.username ?? null}
        discordStatus={discord ?? null}
        prefill={summoner ? decodeURIComponent(summoner) : ""}
      />
    </div>
  );
}
