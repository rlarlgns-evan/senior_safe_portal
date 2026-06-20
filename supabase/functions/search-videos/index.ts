/**
 * Supabase Edge Function: search-videos
 * YouTube 검색 + Gemini AI 안전 분석 (시크릿은 서버 환경 변수만 사용)
 *
 * 배포 방법 (택 1):
 *   A) CLI: supabase functions deploy search-videos
 *   B) 대시보드(한 파일): supabase/deploy/search-videos.ts 전체 붙여넣기
 *      (node scripts/bundle-edge-function.mjs search-videos 실행 후)
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";
import {
  buildCorsHeaders,
  clampLimit,
  jsonResponse,
  sanitizeSearchQuery,
  toClientSafeMessage,
} from "./security.ts";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnails: {
      medium?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
}

interface GeminiAnalysisItem {
  video_id: string;
  status: "안전" | "위험";
  reason: string;
}

interface VideoResult {
  video_id: string;
  title: string;
  description: string;
  channel: string;
  thumbnail: string;
  status: "안전" | "위험";
  reason: string;
}

const LENIENT_ANALYSIS_PROMPT =
  "You are a Senior Digital Sheriff helping Korean seniors browse YouTube.\n"
  + "Mark \"위험\" ONLY when title/description clearly promotes voice-phishing, fake police/bank calls, "
  + "guaranteed investment returns, lottery/prize fee scams, or miracle cure product sales targeting seniors.\n"
  + "Mark \"안전\" for mainstream news, TV clips, music, entertainment, documentaries, exercise, cooking, "
  + "and general education even if unrelated words appear.\n"
  + "When uncertain, choose \"안전\".\n"
  + "Return JSON array only: [{\"video_id\":\"id\",\"status\":\"안전\"|\"위험\",\"reason\":\"simple Korean\"}].";

const STRICT_ANALYSIS_PROMPT =
  "You are a Senior Digital Sheriff. Analyze YouTube titles/descriptions for scams targeting Korean seniors. "
  + "Return JSON array: [{\"video_id\":\"id\",\"status\":\"안전\"|\"위험\",\"reason\":\"simple Korean\"}].";

function resolveAnalysisPrompt(mode: unknown): string {
  return mode === "strict" ? STRICT_ANALYSIS_PROMPT : LENIENT_ANALYSIS_PROMPT;
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

const ALLOWED_YOUTUBE_VIDEO_CATEGORIES = new Set([
  "10", "17", "24", "25", "26", "27", "28",
]);

function sanitizeVideoCategoryId(raw: unknown): string | undefined {
  const id = String(raw ?? "").trim();
  if (!id || !ALLOWED_YOUTUBE_VIDEO_CATEGORIES.has(id)) return undefined;
  return id;
}

/**
 * YouTube Data API v3로 영상 검색
 * @param query - 검증된 검색어
 * @param apiKey - YOUTUBE_API_KEY (서버 전용)
 */
async function fetchYouTubeVideos(
  query: string,
  apiKey: string,
  maxResults: number,
  videoCategoryId?: string,
): Promise<YouTubeSearchItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    regionCode: "KR",
    relevanceLanguage: "ko",
    key: apiKey,
  });

  if (videoCategoryId) {
    params.set("videoCategoryId", videoCategoryId);
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);

  if (!response.ok) {
    let message = "영상 검색 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.";
    try {
      const errBody = await response.json();
      const reason = errBody?.error?.errors?.[0]?.reason ?? "";
      const apiMessage = String(errBody?.error?.message ?? "");
      console.error("YouTube API HTTP", response.status, reason, apiMessage);

      if (
        reason === "quotaExceeded"
        || reason === "dailyLimitExceeded"
        || /quota|exceeded your quota|exceeded/i.test(apiMessage)
      ) {
        message = "오늘 영상 검색 한도를 모두 사용했습니다. 내일 다시 시도해 주세요.";
      } else if (reason === "keyInvalid" || reason === "accessNotConfigured") {
        message = "YouTube API 설정에 문제가 있습니다. 관리자에게 문의해 주세요.";
      } else if (response.status === 403) {
        message = "오늘 영상 검색 한도를 모두 사용했습니다. 내일 다시 시도해 주세요.";
      }
    } catch {
      console.error("YouTube API HTTP", response.status);
    }
    throw new Error(message);
  }

  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

/** 넓은 검색 우선 → 부족하면 카테고리 힌트 검색으로 보충 */
async function fetchYouTubeVideosExpanded(
  query: string,
  apiKey: string,
  maxResults: number,
  videoCategoryId?: string,
): Promise<YouTubeSearchItem[]> {
  const seen = new Set<string>();
  const merged: YouTubeSearchItem[] = [];

  const addItems = (items: YouTubeSearchItem[]) => {
    for (const item of items) {
      const id = item.id?.videoId;
      if (!id || !YOUTUBE_VIDEO_ID_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
      if (merged.length >= maxResults) return;
    }
  };

  addItems(await fetchYouTubeVideos(query, apiKey, maxResults));

  if (merged.length < maxResults && videoCategoryId) {
    addItems(await fetchYouTubeVideos(
      query,
      apiKey,
      maxResults - merged.length,
      videoCategoryId,
    ));
  }

  return merged.slice(0, maxResults);
}

/**
 * Gemini로 영상 제목·설명 안전성 분석
 */
async function analyzeWithGemini(
  videos: YouTubeSearchItem[],
  geminiApiKey: string,
  analysisMode: unknown,
): Promise<GeminiAnalysisItem[]> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const videoData = videos.map((item) => ({
    video_id: item.id.videoId,
    title: item.snippet.title.slice(0, 300),
    description: item.snippet.description.slice(0, 500),
  }));

  const systemPrompt = resolveAnalysisPrompt(analysisMode);

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: `Analyze:\n${JSON.stringify(videoData)}` },
  ]);

  let parsed: GeminiAnalysisItem[];
  try {
    parsed = JSON.parse(result.response.text());
    if (!Array.isArray(parsed)) throw new Error("invalid shape");
  } catch {
    console.error("Gemini JSON parse failed");
    parsed = videos.map((item) => ({
      video_id: item.id.videoId,
      status: "안전" as const,
      reason: "자동 분석을 완료하지 못했습니다.",
    }));
  }

  return parsed.filter((item) =>
    typeof item.video_id === "string"
    && YOUTUBE_VIDEO_ID_PATTERN.test(item.video_id)
    && (item.status === "안전" || item.status === "위험")
  );
}

function mergeVideoResults(
  youtubeItems: YouTubeSearchItem[],
  geminiResults: GeminiAnalysisItem[],
): VideoResult[] {
  const analysisMap = new Map(geminiResults.map((item) => [item.video_id, item]));

  return youtubeItems
    .filter((item) => YOUTUBE_VIDEO_ID_PATTERN.test(item.id.videoId))
    .map((item) => {
      const videoId = item.id.videoId;
      const analysis = analysisMap.get(videoId);
      const thumbnail =
        item.snippet.thumbnails?.medium?.url
        ?? item.snippet.thumbnails?.high?.url
        ?? item.snippet.thumbnails?.default?.url
        ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return {
        video_id: videoId,
        title: item.snippet.title.slice(0, 300),
        description: item.snippet.description.slice(0, 500),
        channel: item.snippet.channelTitle.slice(0, 120),
        thumbnail,
        status: analysis?.status ?? "안전",
        reason: (analysis?.reason ?? "분석 결과 없음").slice(0, 400),
      };
    });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(req, { error: "Method not allowed" }, 405);
    }

    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!youtubeApiKey || !geminiApiKey) {
      console.error("Missing YOUTUBE_API_KEY or GEMINI_API_KEY");
      return jsonResponse(req, {
        error: "검색 실패",
        message: "서버 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
      }, 503);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, {
        error: "검색 실패",
        message: "요청 형식이 올바르지 않습니다.",
      }, 400);
    }

    const query = sanitizeSearchQuery(body?.query);
    const maxResults = clampLimit(body?.limit, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const skipAnalysis = body?.skipAnalysis === true;
    const safeOnly = body?.safeOnly === true;
    const analysisMode = body?.analysisMode;
    const videoCategoryId = sanitizeVideoCategoryId(body?.videoCategoryId);

    const youtubeItems = await fetchYouTubeVideosExpanded(
      query,
      youtubeApiKey,
      maxResults,
      videoCategoryId,
    );

    if (youtubeItems.length === 0) {
      return jsonResponse(req, { videos: [] });
    }

    const geminiResults = skipAnalysis
      ? []
      : await analyzeWithGemini(youtubeItems, geminiApiKey, analysisMode);
    let videos = mergeVideoResults(youtubeItems, geminiResults);

    if (safeOnly) {
      videos = videos.filter((video) => video.status !== "위험");
    }

    return jsonResponse(req, { videos });
  } catch (error) {
    console.error("search-videos error:", error);
    const message = toClientSafeMessage(error, "영상 검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    const isQuota = /한도|quota|exceeded/i.test(message);
    return jsonResponse(req, {
      error: "검색 실패",
      message,
      ...(isQuota ? { code: "YOUTUBE_QUOTA_EXCEEDED" } : {}),
    }, isQuota ? 429 : 400);
  }
});
