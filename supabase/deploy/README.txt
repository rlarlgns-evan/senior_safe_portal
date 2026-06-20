# Supabase 대시보드 Edge Function 배포 가이드

## ⚠️ 중요

Supabase 대시보드는 **한 파일만** 업로드합니다.
`supabase/functions/.../index.ts` 를 붙여넣으면
`security.ts`, `gemini.ts` 를 찾지 못해 배포가 실패합니다.

반드시 **이 폴더(supabase/deploy/)의 .ts 파일**을 사용하세요.

## 배포 순서

1. (코드 수정 후) 프로젝트 루트에서 실행:
   ```
   node scripts/bundle-edge-function.mjs --all
   ```

2. Supabase → Edge Functions → 해당 함수 선택

3. 아래 표의 **deploy 파일 전체**를 복사해 에디터에 붙여넣기

4. Deploy 클릭

## 붙여넣을 파일

| Supabase 함수명 | 붙여넣을 파일 (이 폴더) |
|-----------------|-------------------------|
| analyze-link    | analyze-link.ts         |
| search-videos   | search-videos.ts        |
| chat-agent      | chat-agent.ts           |
| search-welfare  | search-welfare.ts       |

## CLI로 배포하는 경우

`supabase functions deploy <함수명>` 은
`supabase/functions/<함수명>/` 폴더 전체를 업로드하므로
index.ts + security.ts + gemini.ts 가 함께 올라갑니다.

## search-welfare 시크릿

Supabase Project Settings → Edge Functions → Secrets:

| 이름 | 값 |
|------|-----|
| DATA_GO_KR_SERVICE_KEY | 공공데이터포털 일반 인증키(Decoding) |
