/**
 * 유튜브 추천 영상 일괄 수집 → youtube_feeds 테이블 저장
 *
 * 하루 1~2회 실행 시 YouTube API를 약 5~10회만 사용합니다.
 *
 * Secrets: SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (+ search-videos 와 동일 YOUTUBE_API_KEY)
 * 호출: POST + Header x-cron-secret: <CRON_SECRET>
 *
 * node scripts/refresh-youtube-feeds.mjs
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const FEED_CATEGORIES = [
  { id: "music", label: "음악", query: "트로트 명곡 모음" },
  { id: "affairs", label: "시사", query: "KBS 시사뉴스" },
  { id: "entertainment", label: "예능", query: "유퀴즈 온더블럭" },
  { id: "documentary", label: "다큐", query: "EBS 다큐프라임" },
  { id: "health", label: "건강", query: "어르신 건강체조" },
];

const FEED_LIMIT = 50;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || headerSecret !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const results: Array<{ category_id: string; count: number; ok: boolean; message?: string }> = [];

  for (const category of FEED_CATEGORIES) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-videos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: category.query,
          limit: FEED_LIMIT,
          skipAnalysis: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload?.videos)) {
        results.push({
          category_id: category.id,
          count: 0,
          ok: false,
          message: payload?.message || `HTTP ${response.status}`,
        });
        continue;
      }

      const { error } = await supabase.from("youtube_feeds").upsert({
        category_id: category.id,
        label: category.label,
        videos: payload.videos,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      results.push({ category_id: category.id, count: payload.videos.length, ok: true });
    } catch (error) {
      console.error("refresh category failed:", category.id, error);
      results.push({
        category_id: category.id,
        count: 0,
        ok: false,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const successCount = results.filter((row) => row.ok).length;
  return jsonResponse({
    ok: successCount > 0,
    refreshed: successCount,
    total: FEED_CATEGORIES.length,
    results,
  });
});
