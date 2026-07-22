// 디스코드 OAuth 인증 — 지정된 서버(길드) 멤버인지 확인한다.
// 필요 env: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID
// (디스코드 개발자 포털에서 앱 생성 + redirect URI 등록 필요)

import "server-only";
import { randomBytes } from "crypto";
import { cache } from "./cache";

export const DISCORD_SESSION_COOKIE = "discord_session";
export const DISCORD_STATE_COOKIE = "discord_state";
const SESSION_TTL = 60 * 60; // 1시간 — 인증 절차 완료에 충분

export interface DiscordUser {
  id: string;
  username: string;
}

export function isDiscordConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_GUILD_ID,
  );
}

export function discordAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${origin}/api/discord/callback`,
    scope: "identify guilds",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export function newState(): string {
  return randomBytes(16).toString("hex");
}

/** code 교환 → 유저 정보 + 대상 서버 멤버 여부 */
export async function exchangeAndCheckMembership(
  origin: string,
  code: string,
): Promise<{ user: DiscordUser; isMember: boolean } | null> {
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/discord/callback`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) return null;
  const token: { access_token: string } = await tokenRes.json();
  const auth = { Authorization: `Bearer ${token.access_token}` };

  const [meRes, guildsRes] = await Promise.all([
    fetch("https://discord.com/api/users/@me", {
      headers: auth,
      signal: AbortSignal.timeout(10_000),
    }),
    fetch("https://discord.com/api/users/@me/guilds", {
      headers: auth,
      signal: AbortSignal.timeout(10_000),
    }),
  ]);
  if (!meRes.ok || !guildsRes.ok) return null;
  const me: { id: string; username: string; global_name?: string | null } =
    await meRes.json();
  const guilds: { id: string }[] = await guildsRes.json();
  return {
    user: { id: me.id, username: me.global_name || me.username },
    isMember: guilds.some((g) => g.id === process.env.DISCORD_GUILD_ID),
  };
}

export async function createDiscordSession(user: DiscordUser): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await cache.set(`discord-session:${token}`, user, SESSION_TTL);
  return token;
}

export async function getDiscordSession(
  token: string | undefined,
): Promise<DiscordUser | null> {
  if (!token) return null;
  return cache.get<DiscordUser>(`discord-session:${token}`);
}
