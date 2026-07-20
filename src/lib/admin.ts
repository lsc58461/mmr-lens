// 어드민 인증. 계정은 캐시 DB(admin:user:*)에 scrypt 해시로 저장하고,
// 로그인 성공 시 랜덤 토큰 세션(admin-session:*)을 발급해 httpOnly 쿠키로 유지한다.

import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cache } from "@/lib/cache";

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7일

interface AdminUser {
  salt: string;
  hash: string;
}

export async function verifyAdmin(
  username: string,
  password: string,
): Promise<boolean> {
  const user = await cache.get<AdminUser>(`admin:user:${username}`);
  if (!user) return false;
  const hash = scryptSync(password, user.salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(user.hash));
  } catch {
    return false;
  }
}

export async function createAdminSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await cache.set(`admin-session:${token}`, { at: Date.now() }, SESSION_TTL);
  return token;
}

export async function isValidAdminSession(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  return (await cache.get(`admin-session:${token}`)) !== null;
}

export async function destroyAdminSession(
  token: string | undefined,
): Promise<void> {
  if (!token) return;
  await cache.set(`admin-session:${token}`, null, 1);
}
