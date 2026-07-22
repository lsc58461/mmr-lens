// 어드민 인증. 계정은 admin_users(scrypt 해시), 세션은 admin_sessions 테이블.

import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import {
  adminExpireSession,
  adminFindUser,
  adminInsertSession,
  adminSessionValid,
} from "./store";

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7일

export async function verifyAdmin(
  username: string,
  password: string,
): Promise<boolean> {
  const user = await adminFindUser(username).catch(() => null);
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
  await adminInsertSession(token, SESSION_TTL);
  return token;
}

export async function isValidAdminSession(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  return adminSessionValid(token).catch(() => false);
}

export async function destroyAdminSession(
  token: string | undefined,
): Promise<void> {
  if (!token) return;
  await adminExpireSession(token).catch(() => {});
}
