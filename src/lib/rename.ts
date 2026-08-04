// 닉변 리다이렉트 대상 해석.
//
// 롤 Riot ID는 재사용 가능하다 — A가 놓은 이름을 B가 가져갈 수 있다.
// 그래서 name_history 매핑만 믿고 리다이렉트하면 B를 검색한 사람이 A 페이지로
// 끌려가는 오작동이 난다. 리다이렉트 직전에 옛 이름이 아직 비어 있는지 확인하고,
// 주인이 생겼으면 매핑을 폐기한다(자가 치유).

import "server-only";
import { isRiotIdTaken } from "./riot/client";
import { clearRenameMapping, findRenamedTo } from "./store";
import type { PlatformRegion } from "./riot/types";

export async function resolveRenameTarget(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
): Promise<{ gameName: string; tagLine: string } | null> {
  const to = await findRenamedTo(platform, gameName, tagLine).catch(() => null);
  if (!to) return null;

  const taken = await isRiotIdTaken(platform, gameName, tagLine).catch(
    () => null,
  );
  if (taken === true) {
    // 남이 그 이름을 쓰고 있다(혹은 본인이 되돌렸다) — 매핑은 더 이상 유효하지 않다
    await clearRenameMapping(platform, gameName, tagLine).catch(() => {});
    return null;
  }
  // false(비어 있음) 또는 null(확인 실패) — 기존 매핑 유지
  return to;
}
