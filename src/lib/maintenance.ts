import "server-only";
import { cache } from "@/lib/cache";

export const MAINTENANCE_KEY = "maintenance:flag";

export interface MaintenanceInfo {
  on: boolean;
  reason?: string | null;
  startsAt?: string | null; // ISO
  endsAt?: string | null; // ISO
}

/** 예약 창을 반영한 실제 활성 여부 — 기간이 지나면 자동 해제된 것으로 취급 */
export function isMaintenanceActive(info: MaintenanceInfo | null): boolean {
  if (!info?.on) return false;
  const now = Date.now();
  if (info.startsAt && now < Date.parse(info.startsAt)) return false;
  if (info.endsAt && now >= Date.parse(info.endsAt)) return false;
  return true;
}

export function getMaintenanceInfo(): Promise<MaintenanceInfo | null> {
  return cache.get<MaintenanceInfo>(MAINTENANCE_KEY);
}
