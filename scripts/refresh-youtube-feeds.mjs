#!/usr/bin/env node
/**
 * 유튜브 추천 영상 DB 갱신 (refresh-youtube-feeds Edge Function 호출)
 *
 * 환경 변수:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (Supabase Dashboard → Settings → API)
 *   CRON_SECRET                (Edge Functions Secrets에 등록한 값과 동일)
 *
 * 사용:
 *   set SUPABASE_URL=https://xxx.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   set CRON_SECRET=your-secret
 *   node scripts/refresh-youtube-feeds.mjs
 */

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

if (!url || !serviceKey || !cronSecret) {
  console.error("필요 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET");
  process.exit(1);
}

const response = await fetch(`${url}/functions/v1/refresh-youtube-feeds`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
    "x-cron-secret": cronSecret,
  },
  body: "{}",
});

const data = await response.json().catch(() => ({}));
console.log(JSON.stringify(data, null, 2));

if (!response.ok || !data.ok) {
  process.exit(1);
}
