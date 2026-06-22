# 유튜브 추천 영상 — DB 캐시 + 자동 갱신

## 왜 바꾸나요?

YouTube Data API 무료 한도는 **하루 약 100회 검색**(10,000 units)입니다.  
**미리 수집 → DB 저장 → 모두 같은 목록 조회**하면 하루 **15회**(3회×5카테고리)만 씁니다.

---

## 최초 설정 (1회)

### 1. SQL

Supabase **SQL Editor** → `supabase/migrations/youtube_feeds.sql` 실행

### 2. Edge Functions 배포

| 함수 | 파일 |
|------|------|
| `search-videos` | `supabase/deploy/search-videos.ts` |
| `refresh-youtube-feeds` | `supabase/functions/refresh-youtube-feeds/index.ts` |

### 3. Supabase Edge Function Secrets


**Project Settings → Edge Functions → Secrets**

| Name | 설명 |
|------|------|
| `CRON_SECRET` | 임의의 긴 비밀 문자열 |
| `YOUTUBE_API_KEY` | search-videos용 |
| `GEMINI_API_KEY` | (검색창 실시간 검색 시) |

---

## GitHub Actions 자동화 (권장)

### 1. GitHub Secrets 등록

저장소 **Settings → Secrets and variables → Actions → New repository secret**

| Secret 이름 | 값 |
|-------------|-----|
| `SUPABASE_URL` | `https://oweduuhfkiutlszfwukt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** |
| `CRON_SECRET` | Supabase Secrets에 넣은 값과 **동일** |

⚠️ `service_role` 키는 절대 공개 저장소·채팅에 올리지 마세요.

### 2. workflow 파일

`.github/workflows/refresh-youtube-feeds.yml` — main 브랜치에 push 되면 활성화됩니다.

### 3. 실행 시각 (KST)

| KST | 내용 |
|-----|------|
| **09:00** | 1차 수집 |
| **15:00** | 2차 수집 |
| **21:00** | 3차 수집 |

하루 **5카테고리 × 3회 = 15번** 검색 ≈ **1,500 units** (한도 15%)

### 4. 수동 실행

GitHub → **Actions** → **Refresh YouTube Feeds** → **Run workflow**

### 5. 성공 확인

Actions 로그에 `"ok": true`, `"refreshed": 5` 표시  
Supabase **Table Editor** → `youtube_feeds` 5행 확인

---

## 수동 실행 (PC)

```powershell
$env:SUPABASE_URL="https://oweduuhfkiutlszfwukt.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="(service_role)"
$env:CRON_SECRET="(CRON_SECRET)"
node tools/refresh-youtube-feeds.mjs
```

---

## 동작

| 기능 | 데이터 |
|------|--------|
| 홈·유튜브 탭 | `youtube_feeds` DB |
| DB 비어 있음 | 코드 fallback 영상 |
| 검색창 텍스트 | `search-videos` (실시간) |
| 링크 검사 | `analyze-link` (YouTube API 무관) |
