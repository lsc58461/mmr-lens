import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "업데이트 내역",
  description: "MMR Lens의 기능 추가와 개선 사항 기록",
};

type Tag = "신규" | "개선" | "수정";

const TAG_VARIANT: Record<Tag, "default" | "secondary" | "outline"> = {
  신규: "default",
  개선: "secondary",
  수정: "outline",
};

const CHANGELOG: {
  date: string;
  title: string;
  items: { tag: Tag; text: string }[];
}[] = [
  {
    date: "2026-07-22",
    title: "새 도구 3종과 디스코드 알림",
    items: [
      {
        tag: "신규",
        text: "내전 팀 밸런서 — 추정 MMR로 가장 공평한 팀 자동 구성",
      },
      { tag: "신규", text: "듀오 궁합 분석 — 함께한 경기 승률·맞대결 기록" },
      { tag: "신규", text: "시즌 결산 — 판수·승률·최다 챔피언 카드" },
      {
        tag: "신규",
        text: "디스코드 승급/강등 알림 (웹훅 연동)",
      },
    ],
  },
  {
    date: "2026-07-22",
    title: "LP 흐름 추적과 내부 구조 개선",
    items: [
      {
        tag: "신규",
        text: "LP 흐름 카드 — 승리당/패배당 평균 LP로 내부 MMR 신호를 교차 확인 (데이터가 쌓이면 표시)",
      },
      { tag: "신규", text: "업데이트 내역·점검 안내 페이지" },
      {
        tag: "개선",
        text: "데이터 구조 전면 개편 — 분석 기록 영구 보관, 랭크 히스토리 축적 시작",
      },
      {
        tag: "수정",
        text: "전각 문자 태그(ＫR1 등)가 다른 소환사로 취급되던 문제",
      },
    ],
  },
  {
    date: "2026-07-21",
    title: "편의 기능과 안정성 업데이트",
    items: [
      { tag: "신규", text: "자주 묻는 질문(FAQ) 페이지" },
      { tag: "신규", text: "업데이트 내역 페이지" },
      { tag: "신규", text: "재분석 버튼 — 방금 끝난 게임을 즉시 반영" },
      { tag: "신규", text: "정밀 분석 대기열 — 순번과 남은 분석 수 표시" },
      {
        tag: "신규",
        text: "새벽 자동 갱신(3~7시) — 아침에는 항상 최신 결과로 시작",
      },
      {
        tag: "개선",
        text: "이전 분석 즉시 표시 — 재분석을 기다리는 동안에도 결과를 바로 확인",
      },
      {
        tag: "개선",
        text: "결과 보관 기간 30일로 연장 — 오래 안 봐도 기록이 사라지지 않음",
      },
      {
        tag: "수정",
        text: "한국 서버 마스터 이상 구간의 듀오 오탐 수정 (듀오 금지 구간 감지 제외)",
      },
      {
        tag: "수정",
        text: "카카오톡 인앱 브라우저에서 이미지 공유가 안 되던 문제",
      },
    ],
  },
  {
    date: "2026-07-20",
    title: "정확도 개선과 새 기능",
    items: [
      { tag: "신규", text: "듀오 추정 경기 자동 감지·분석 제외 (부족분은 과거 경기로 보충)" },
      { tag: "신규", text: "결과 이미지 공유 — 카톡·디스코드 링크 미리보기 지원" },
      { tag: "신규", text: "최근 검색 페이지" },
      { tag: "신규", text: "챔피언 아이콘·티어 엠블럼·한글 챔피언명" },
      {
        tag: "개선",
        text: "추정 알고리즘 고도화 — 리메이크 제외, 이상치 완화, 승패 반영(Elo), 오차범위 표시",
      },
      { tag: "개선", text: "전체 디자인 개편 (블루·골드 테마, 다크모드)" },
    ],
  },
  {
    date: "2026-07-19",
    title: "MMR Lens 오픈",
    items: [
      {
        tag: "신규",
        text: "숨겨진 MMR 추정 — 최근 경기 로비의 랭크를 역추적해 계산",
      },
      { tag: "신규", text: "정밀 분석 — 20경기 × 전원 표본, 완료 시 자동 갱신" },
      { tag: "신규", text: "경기별 MMR 추이 그래프" },
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Megaphone className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            업데이트 내역
          </h1>
          <p className="text-sm text-muted-foreground">
            MMR Lens가 이렇게 좋아지고 있어요
          </p>
        </div>
      </div>

      <div className="relative space-y-8 border-l pl-6">
        {CHANGELOG.map((entry) => (
          <section key={entry.date} className="relative">
            <span className="absolute left-[-1.85rem] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" />
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-semibold">{entry.title}</h2>
              <time className="text-xs text-muted-foreground">
                {entry.date}
              </time>
            </div>
            <ul className="space-y-1.5">
              {entry.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={TAG_VARIANT[item.tag]}
                    className="mt-px shrink-0 text-[10px]"
                  >
                    {item.tag}
                  </Badge>
                  <span className="text-muted-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
