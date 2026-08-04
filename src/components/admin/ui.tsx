// 어드민 공용 프리미티브 — 페이지 헤더/통계 타일/상태 점/빈 상태.
// 다섯 페이지가 같은 리듬을 갖도록 여기서만 스타일을 정의한다.

import type { ComponentType, ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b pb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

const TONES = {
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground",
} as const;

export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "muted",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
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

/** 자동 갱신 표시 — 살아 있으면 점이 맥동한다 */
export function LiveDot({ on = true, label }: { on?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted-foreground tabular-nums">
      <span className="relative flex size-1.5">
        {on && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" />
        )}
        <span
          className={`relative inline-flex size-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
        />
      </span>
      {label}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
      {Icon && <Icon className="size-5 opacity-40" />}
      {children}
    </div>
  );
}
