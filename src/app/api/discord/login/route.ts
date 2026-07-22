import { NextResponse, type NextRequest } from "next/server";
import {
  DISCORD_STATE_COOKIE,
  discordAuthUrl,
  isDiscordConfigured,
  newState,
} from "@/lib/discord-auth";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(
      new URL("/verify?discord=unconfigured", req.nextUrl.origin),
    );
  }
  const state = newState();
  const res = NextResponse.redirect(discordAuthUrl(req.nextUrl.origin, state));
  res.cookies.set(DISCORD_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });
  return res;
}
