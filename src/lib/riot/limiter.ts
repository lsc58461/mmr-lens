// 개발용 API 키 제한(20req/1s, 100req/120s)에 맞춘 토큰 버킷 레이트리미터.
// 서버 인스턴스당 하나만 존재하면 되므로 모듈 스코프 싱글턴으로 둔다.

interface Bucket {
  capacity: number;
  windowMs: number;
  timestamps: number[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class RateLimiter {
  private buckets: Bucket[];
  private queue: Promise<void> = Promise.resolve();

  constructor(limits: Array<{ capacity: number; windowMs: number }>) {
    this.buckets = limits.map((l) => ({ ...l, timestamps: [] }));
  }

  /** 슬롯이 날 때까지 대기 후 반환. 호출 순서를 보장하기 위해 큐로 직렬화한다. */
  acquire(): Promise<void> {
    const next = this.queue.then(async () => {
      while (true) {
        const now = Date.now();
        let waitMs = 0;
        for (const b of this.buckets) {
          b.timestamps = b.timestamps.filter((t) => now - t < b.windowMs);
          if (b.timestamps.length >= b.capacity) {
            waitMs = Math.max(waitMs, b.timestamps[0] + b.windowMs - now + 20);
          }
        }
        if (waitMs === 0) break;
        await sleep(waitMs);
      }
      const now = Date.now();
      for (const b of this.buckets) b.timestamps.push(now);
    });
    // 실패해도 큐가 막히지 않게 한다
    this.queue = next.catch(() => {});
    return next;
  }
}

// 실제 한도보다 약간 보수적으로 잡아 429를 예방한다
export const riotLimiter = new RateLimiter([
  { capacity: 18, windowMs: 1_000 },
  { capacity: 95, windowMs: 120_000 },
]);
