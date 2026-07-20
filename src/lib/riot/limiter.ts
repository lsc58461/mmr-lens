// 개발용 API 키 제한(20req/1s, 100req/120s)에 맞춘 토큰 버킷 레이트리미터.
// 우선순위 2단계: 페이지 로딩 등 전경 호출(high)이 백그라운드 정밀 분석(low)보다
// 항상 먼저 슬롯을 받는다 — 정밀 분석이 한도를 점유해도 페이지가 굶지 않는다.
// 서버 인스턴스당 하나만 존재하면 되므로 모듈 스코프 싱글턴으로 둔다.

import { AsyncLocalStorage } from "async_hooks";

interface Bucket {
  capacity: number;
  windowMs: number;
  timestamps: number[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Priority = "high" | "low";

// 호출 경로 전체에 priority 인자를 뚫는 대신 ALS 컨텍스트로 전달한다
const priorityContext = new AsyncLocalStorage<Priority>();

/** 이 콜백 안에서 발생하는 라이엇 API 호출을 저우선순위로 처리 */
export function withLowPriority<T>(fn: () => Promise<T>): Promise<T> {
  return priorityContext.run("low", fn);
}

export function currentPriority(): Priority {
  return priorityContext.getStore() ?? "high";
}

class RateLimiter {
  private buckets: Bucket[];
  private high: Array<() => void> = [];
  private low: Array<() => void> = [];
  private pumping = false;

  constructor(limits: Array<{ capacity: number; windowMs: number }>) {
    this.buckets = limits.map((l) => ({ ...l, timestamps: [] }));
  }

  /** 슬롯이 날 때까지 대기 후 반환. high 큐가 항상 low 큐보다 먼저 소진된다 */
  acquire(priority: Priority = "high"): Promise<void> {
    return new Promise<void>((resolve) => {
      (priority === "high" ? this.high : this.low).push(resolve);
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.high.length > 0 || this.low.length > 0) {
        const now = Date.now();
        let waitMs = 0;
        for (const b of this.buckets) {
          b.timestamps = b.timestamps.filter((t) => now - t < b.windowMs);
          if (b.timestamps.length >= b.capacity) {
            waitMs = Math.max(waitMs, b.timestamps[0] + b.windowMs - now + 20);
          }
        }
        if (waitMs > 0) {
          await sleep(waitMs);
          continue;
        }
        const next = this.high.shift() ?? this.low.shift();
        if (!next) break;
        const ts = Date.now();
        for (const b of this.buckets) b.timestamps.push(ts);
        next();
      }
    } finally {
      this.pumping = false;
    }
  }
}

// 실제 한도보다 약간 보수적으로 잡아 429를 예방한다.
// RIOT_KEY_TYPE=prod 이면 Production 키 한도(500/10s, 30000/10min) 기준으로 동작한다.
export const riotLimiter =
  process.env.RIOT_KEY_TYPE === "prod"
    ? new RateLimiter([
        { capacity: 450, windowMs: 10_000 },
        { capacity: 27_000, windowMs: 600_000 },
      ])
    : new RateLimiter([
        { capacity: 18, windowMs: 1_000 },
        { capacity: 95, windowMs: 120_000 },
      ]);
