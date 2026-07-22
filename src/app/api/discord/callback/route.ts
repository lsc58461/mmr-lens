import { NextResponse, type NextRequest } from "next/server";
import {
  DISCORD_SESSION_COOKIE,
  DISCORD_STATE_COOKIE,
  createDiscordSession,
  exchangeAndCheckMembership,
} from "@/lib/discord-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (q: string) => NextResponse.redirect(new URL(`/verify?discord=${q}`, origin));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get(DISCORD_STATE_COOKIE)?.value;
  if (!code || !state || !savedState || state !== savedState) {
    return back("error");
  }

  const result = await exchangeAndCheckMembership(origin, code).catch(
    () => null,
  );
  if (!result) return back("error");
  if (!result.isMember) return back("notmember");

  const token = await createDiscordSession(result.user);
  const res = back("ok");
  res.cookies.set(DISCORD_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 3600,
  });
  res.cookies.set(DISCORD_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
