import { CircleHelp } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata = {
  title: "자주 묻는 질문",
  description:
    "MMR Lens의 추정 MMR 계산 방식, 정밀 분석, 듀오 제외 등 자주 묻는 질문 모음",
};

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "추정 MMR이 내 실력을 평가하는 건가요?",
    a: (
      <>
        정확히는 <b>라이엇 매칭 시스템이 당신을 어느 실력대로 보고 있는지</b>를
        추정합니다. 롤은 겉으로 보이는 티어와 별개로 숨겨진 점수(MMR)로 매칭을
        잡는데, MMR Lens는 최근 경기에서 만난 팀원·상대 수십 명의 실제 티어를
        조회해 &ldquo;평균적으로 어느 실력대 로비에 배정되고 있는지&rdquo;를
        역추적합니다. KDA 같은 플레이 지표를 채점하는 것이 아니라, 매칭
        데이터라는 객관적 사실을 집계하는 방식이에요.
      </>
    ),
  },
  {
    q: "추정 MMR이 티어보다 높으면/낮으면 무슨 뜻인가요?",
    a: (
      <>
        추정 MMR이 티어보다 <b>높으면</b> 시스템이 당신을 현재 티어보다 높게
        평가 중이라는 뜻으로, 승리 시 LP를 많이 받고 곧 티어가 따라 올라갈
        가능성이 큽니다. <b>낮으면</b> 반대로 LP 효율이 나쁠 수 있어요. 판독
        코멘트와 ±pt 갭이 이를 요약해 보여줍니다.
      </>
    ),
  },
  {
    q: "오차범위(±pt)와 신뢰도는 뭔가요?",
    a: (
      <>
        경기마다 로비 평균이 흔들리기 때문에, 로비 평균들의 통계적 표준오차로
        95% 오차범위를 계산해 함께 표시합니다. 신뢰도(높음/보통/낮음)는 분석에
        사용된 표본(참가자 랭크) 수 기준이에요. 표본이 적을수록 오차가 커질 수
        있습니다.
      </>
    ),
  },
  {
    q: "정밀 분석은 뭐가 다른가요? 왜 기다려야 하나요?",
    a: (
      <>
        첫 검색은 최근 8경기 × 팀별 3명 표본으로 빠르게 추정하고, 백그라운드에서{" "}
        <b>20경기 × 본인 제외 전원(9명)</b>을 조회하는 정밀 분석이 돌아갑니다.
        라이엇 API 호출 한도 때문에 정밀 분석은 몇 분 걸리고, 여러 명이 동시에
        요청하면 선착순 대기열로 처리돼요. 분석이 시작된 뒤에는 화면을 나가도
        계속 진행되고 결과가 저장됩니다.
      </>
    ),
  },
  {
    q: "듀오 경기는 왜 분석에서 제외하나요?",
    a: (
      <>
        듀오로 잡힌 경기는 파트너의 MMR이 매칭에 영향을 줘서 로비 평균이 본인
        실력과 어긋날 수 있습니다. 그래서 최근 경기에서 같은 팀에 반복 등장한
        플레이어가 있는 경기는 듀오로 간주해 제외하고, 부족한 표본은 더 과거
        경기로 채웁니다. 단 <b>한국 서버 마스터 이상</b>(전 서버 그랜드마스터
        이상)은 듀오가 금지된 구간이라 이 감지를 적용하지 않아요.
      </>
    ),
  },
  {
    q: "방금 게임이 끝났는데 결과에 반영이 안 돼요",
    a: (
      <>
        경기 목록은 몇 분 단위로 캐시됩니다. 결과 페이지의 <b>재분석 버튼</b>을
        누르면 캐시를 우회해 즉시 새 경기를 확인하고, 변화가 있을 때만 다시
        분석해요. (남용 방지를 위해 소환사당 1분에 한 번만 가능합니다)
      </>
    ),
  },
  {
    q: "결과가 이전과 왜 조금씩 달라지나요?",
    a: (
      <>
        추정치는 최근 경기 창(window) 기준이라 새 경기가 반영될 때마다
        움직입니다. 또 참가자들의 티어도 계속 변하기 때문에 같은 경기라도 조회
        시점에 따라 로비 평균이 미세하게 달라질 수 있어요. 알고리즘이 개선되면
        기존 결과가 자동으로 재계산되기도 합니다.
      </>
    ),
  },
  {
    q: "라이엇 공식 서비스인가요?",
    a: (
      <>
        아니요. MMR Lens는 라이엇 게임즈와 무관한 비공식 팬 프로젝트이며, 공식
        API의 공개 데이터만 사용합니다. 라이엇은 실제 MMR 수치를 공개하지
        않으므로 여기의 모든 수치는 <b>통계적 추정치</b>이고 재미·참고용으로만
        봐주세요.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CircleHelp className="size-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            자주 묻는 질문
          </h1>
          <p className="text-sm text-muted-foreground">
            추정 MMR이 어떻게 계산되는지 궁금하다면
          </p>
        </div>
      </div>

      <Accordion multiple={false} className="w-full">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`q${i}`}>
            <AccordionTrigger className="text-left text-sm font-medium">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
