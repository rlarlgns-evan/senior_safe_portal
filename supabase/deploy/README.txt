# Supabase 대시보드 배포용 (자동 생성)

`analyze-link`, `search-videos`, `search-welfare`는 **이 폴더의 `.ts` 파일**을 Supabase에 붙여넣으세요.

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
| search-welfare | `search-welfare.ts` |

## search-welfare 시크릿

Supabase **Project Settings → Edge Functions → Secrets** 에 등록:

| 이름 | 값 |
|------|-----|
| `DATA_GO_KR_SERVICE_KEY` | [공공데이터포털](https://www.data.go.kr) **일반 인증키**(Decoding) |

- URL 인코딩된 키도 동작합니다.
- `get-weather`, `chat-agent` 등 다른 함수는 `supabase/functions/<이름>/index.ts` 를 그대로 배포하면 됩니다.
