import { Activity, Gauge, Users } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      "경기별 로비 평균 MMR을 그래프로 보여줘 상승세인지 하락세인지 한눈에 확인할 수 있습니다.",
  },
  {
    icon: Users,
    title: "티어 대비 실력 판독",
    description:
      "겉보기 티어와 추정 MMR의 차이를 계산해 지금이 승급 구간인지 알려줍니다.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-12 py-8 sm:py-16">
      <div className="max-w-2xl space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          내 진짜 <span className="text-primary">MMR</span>은 몇 점일까?
        </h1>
        <p className="text-muted-foreground sm:text-lg">
          라이엇이 공개하지 않는 숨겨진 MMR을
          <br className="sm:hidden" /> 최근 경기 데이터로 추정해 드립니다.
        </p>
      </div>

      <div className="w-full max-w-xl">
        <SearchForm />
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-1 size-5 text-primary" />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
