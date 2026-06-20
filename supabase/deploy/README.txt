# Supabase 대시보드 배포용 (자동 생성)

`analyze-link`, `search-videos`는 **이 폴더의 `.ts` 파일**을 Supabase에 붙여넣으세요.

`supabase/functions/.../index.ts` 를 직접 붙여넣으면 `@shared` import 오류가 납니다.

## 갱신 방법

프로젝트 루트에서:

```
node scripts/bundle-edge-function.mjs --all
```

## 붙여넣을 파일

| Supabase 함수 | 파일 |
|---------------|------|
| analyze-link | `analyze-link.ts` |
| search-videos | `search-videos.ts` |
