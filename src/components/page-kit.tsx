// 사용자 페이지 공용 프리미티브.
// 페이지 헤더·통계 타일·빈 상태가 페이지마다 따로 구현돼 리듬이 어긋나 있었다.
// 여기서만 정의하고 각 페이지는 조합만 한다.

import type { ComponentType, ReactNode } from "react";

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

const STAT_TONES = {
  default: "",
  positive: "text-emerald-500",
  negative: "text-red-500",
  muted: "text-muted-foreground",
} as const;

export function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  color,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  /** 티어 색 등 직접 지정 (tone보다 우선) */
  color?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`mt-1.5 truncate text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${STAT_TONES[tone]}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

/** 결과가 나오기 전 자리를 채우는 안내 — 도구 페이지가 빈 화면으로 보이지 않게 */
export function EmptyHint({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon className="size-6 text-muted-foreground/40" />
      <div className="text-sm font-medium">{title}</div>
      {children && (
        <p className="max-w-sm text-xs text-pretty text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}
