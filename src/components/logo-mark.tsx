// 파비콘(src/app/icon.svg)과 동일한 브랜드 마크.
// 파비콘·GNB·공유 이미지가 모두 이 디자인을 공유한다 — 수정 시 세 곳 모두 반영할 것.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logo-g)" />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#ffffff" strokeWidth="4.5" />
      <circle cx="44" cy="20" r="4.5" fill="#fbbf24" />
    </svg>
  );
}
