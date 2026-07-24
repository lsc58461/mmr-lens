import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 배포·설정 확인용 (값은 노출하지 않고 존재 여부만)
export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    storage: "tables",
    discord: {
      publicKey: Boolean(process.env.DISCORD_PUBLIC_KEY),
      botToken: Boolean(process.env.DISCORD_BOT_TOKEN),
      clientId: Boolean(process.env.DISCORD_CLIENT_ID),
    },
  });
}
