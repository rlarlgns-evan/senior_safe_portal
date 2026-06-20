# QA Self-Verification Checklist

시니어 디지털 보안관 — 리팩터링 후 수동 점검 목록

## Gerontology UX (5규칙)

- [ ] 오류·로딩 메시지는 사용자가 **닫기** 버튼을 누르기 전까지 사라지지 않는다
- [ ] 모든 주요 버튼·탭·칩은 **최소 60px** 터치 영역을 유지한다
- [ ] 폼 라벨은 placeholder만으로 대체되지 않는다
- [ ] 각 화면에 **뒤로가기/홈** 경로가 명확하다
- [ ] API·네트워크 오류는 기술 용어 없이 **한국어 안내**로 표시된다

## 페이지별

### index.html (data-page="home")
- [ ] 헤더·로그인·날씨·푸터 정상
- [ ] 링크/텍스트 검사 → `#results` SPA 전환
- [ ] 유튜브·뉴스·복지 탭 자동 전환 (클릭 후 1분 일시정지)
- [ ] 챗봇 열기·칩·입력·전송
- [ ] `results.html` 접속 시 `index.html#results` 리다이렉트

### youtube / news / welfare (data-page="browse")
- [ ] 카테고리 탭·URL `?category=` 동기화
- [ ] 썸네일·더보기 링크
- [ ] 복지: 위치 재설정 버튼

### board.html (data-page="board")
- [ ] 비로그인: 읽기만, 글쓰기 시 로그인 유도
- [ ] 로그인: 글 작성·본인 글 삭제 (confirm)
- [ ] 조회수 증가 (RLS)

### 정적 페이지 (team, community, privacy, terms)
- [ ] 헤더·푸터·로그인 모달

## 보안

- [ ] 사용자 입력은 `escapeHtml` / `validateTextInput` 경유
- [ ] Edge Function: `@shared` → `../_shared` import (배포본 `supabase/deploy/*.ts`)
- [ ] Supabase SQL: `supabase/migrations/board_posts.sql` 한 번 실행

## 배포 (수동)

1. GitHub Pages: `main` push
2. Supabase Dashboard → Edge Functions → `search-videos`, `analyze-link` (`supabase/deploy/` 내용 붙여넣기)
