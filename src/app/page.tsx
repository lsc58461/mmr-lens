import { Activity, Gauge, Sparkles, Users } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: Gauge,
    title: "숨겨진 MMR 추정",
    description:
      "최근 솔로랭크 경기에서 만난 플레이어들의 현재 랭크를 역추적해 실제 매칭 실력대를 계산합니다.",
  },
  {
    icon: Activity,
    title: "MMR 추이 그래프",
    description:
      "경기별 로비 평균 MMR과 추정 MMR 궤적을 그래프로 보여줘 상승세인지 하락세인지 한눈에 확인할 수 있습니다.",
  },
  {
    icon: Users,
    title: "티어 대비 실력 판독",
    description:
      "겉보기 티어와 추정 MMR의 차이를 계산해 지금이 승급 구간인지 알려줍니다.",
  },
] as const;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MMR Lens",
  url: "https://mmr-lens.kro.kr",
  description:
    "리그 오브 레전드 솔로랭크의 숨겨진 MMR을 최근 경기 데이터로 추정하는 사이트",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate:
        "https://mmr-lens.kro.kr/summoner/kr/{search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-14 py-10 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <div className="max-w-2xl space-y-5 text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
        <Badge
          variant="outline"
          className="gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-primary"
        >
          <Sparkles className="size-3.5" />
          라이엇 공식 API 데이터 기반
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          내 진짜{" "}
          <span className="bg-linear-to-r from-primary via-primary to-chart-2 bg-clip-text text-transparent">
            MMR
          </span>
          은
          <br className="sm:hidden" /> 몇 점일까?
        </h1>
        <p className="text-muted-foreground text-pretty sm:text-lg">
          라이엇이 공개하지 않는 숨겨진 MMR을 최근 경기 데이터로 추정해
          드립니다.
        </p>
      </div>

      <div className="w-full max-w-xl rounded-2xl border bg-card/80 p-5 shadow-lg shadow-primary/5 ring-1 ring-primary/10 backdrop-blur-sm sm:p-6 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-150 fill-mode-backwards">
        <SearchForm />
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300 fill-mode-backwards">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
          >
            <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4.5" />
            </span>
            <h2 className="mb-1.5 text-sm font-semibold">{title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
