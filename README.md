# MMR Lens

라이엇이 공개하지 않는 롤 솔로랭크의 숨겨진 MMR을 추정해 보여주는 웹사이트.

최근 솔로랭크 경기에서 같은 로비에 배정된 플레이어들의 현재 랭크를 역추적해,
"실제로 어느 실력대와 매칭되고 있는지"를 계산합니다.

## 스택

- **Next.js 16** (App Router, React 19)
- **shadcn/ui** + Tailwind CSS v4 (다크모드 지원)
- **Recharts** (shadcn chart) — MMR 추이 그래프
- **캐시**: 기본 인메모리 / `DATABASE_URL` 설정 시 Postgres(Supabase) 자동 사용

## 실행

```bash
npm install
cp .env.example .env.local  # RIOT_API_KEY 채우기
npm run dev
```

> 라이엇 개발용 API 키는 https://developer.riotgames.com 에서 발급하며 **24시간마다 만료**됩니다.

## MMR 추정 방식

1. 최근 솔로랭크 8경기의 매치 상세를 조회
2. 경기마다 양 팀에서 3명씩 샘플링해 참가자들의 **현재 솔로랭크**를 조회
3. 티어/디비전/LP를 단일 포인트로 환산 (아이언4 0LP = 0pt, 디비전당 100pt, 마스터+ = 2800pt + LP)
4. 경기별 로비 평균을 최신 경기 가중(0.85^n)으로 평균 + 최근 승률 보정(±75pt)
5. 표본 수 기준으로 신뢰도(높음/보통/낮음) 표기

개발용 API 키의 호출 제한(20회/초, 100회/2분)에 맞춰 토큰 버킷 레이트리미터로
모든 호출을 직렬화하고, 매치 상세·랭크 조회 결과는 캐시에 저장해 재검색 시 호출을 아낍니다.

## Supabase 연결 (선택)

70명 규모면 무료 티어로 충분합니다.

1. https://supabase.com 에서 프로젝트 생성 (무료, 카드 불필요)
2. Project Settings → Database → Connection string (URI) 복사
3. `.env.local`에 `DATABASE_URL=...` 추가

첫 요청 시 `cache_entries` 테이블이 자동 생성됩니다. 별도 마이그레이션 불필요.
