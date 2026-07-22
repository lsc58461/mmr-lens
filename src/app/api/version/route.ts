import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 배포 확인용 — Vercel이 빌드 시 커밋 SHA를 넣어준다
export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    storage: "tables", // DB 구조 개선(도메인 테이블) 적용 여부 마커
  });
}
