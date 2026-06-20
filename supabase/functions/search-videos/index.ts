/**
 * Supabase Edge Function: search-videos
 * 시니어 디지털 보안관 - YouTube 검색 + Gemini AI 안전 분석
 *
 * Deno 런타임 / TypeScript
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

// ============================================
// CORS 헤더 설정
// ============================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// 타입 정의
// ============================================

/** YouTube Data API v3 검색 결과 아이템 */
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

/** Gemini 분석 결과 (단일 영상) */
interface GeminiAnalysisItem {
  video_id: string;
  status: "안전" | "위험";
  reason: string;
}

/** 클라이언트에 반환할 최종 영상 객체 */
interface VideoResult {
  video_id: string;
  title: string;
  description: string;
  channel: string;
  thumbnail: string;
  status: "안전" | "위험";
  reason: string;
}

// ============================================
// YouTube Data API v3 호출
// ============================================

/**
 * Google YouTube Data API v3로 상위 5개 영상 검색
 * @param query - 검색어
 * @param apiKey - YouTube API Key
 */
async function fetchYouTubeVideos(
  query: string,
  apiKey: string,
): Promise<YouTubeSearchItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "5",
    regionCode: "KR",
    relevanceLanguage: "ko",
    key: apiKey,
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YouTube API 오류 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.items ?? [];
}

// ============================================
// Gemini AI 안전 분석
// ============================================

/**
 * Gemini 1.5 Flash로 YouTube 영상 제목/설명의 안전성 분석
 * @param videos - YouTube 검색 결과
 * @param geminiApiKey - Gemini API Key
 */
async function analyzeWithGemini(
  videos: YouTubeSearchItem[],
  geminiApiKey: string,
): Promise<GeminiAnalysisItem[]> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  // Gemini에 전달할 영상 정보 구성
  const videoData = videos.map((item) => ({
    video_id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
  }));

  const systemPrompt = `You are a Senior Digital Sheriff. Analyze the provided YouTube video titles and descriptions to detect exaggerated ads, fake news, or scam information targeting Korean seniors. You must strictly return a JSON array in the following format: [{'video_id': 'id', 'status': '안전' or '위험', 'reason': '1-sentence reason in simple Korean'}].`;

  const userPrompt = `Analyze these YouTube videos for safety:\n${JSON.stringify(videoData, null, 2)}`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt },
  ]);

  const responseText = result.response.text();

  // JSON 파싱
  let parsed: GeminiAnalysisItem[];
  try {
    parsed = JSON.parse(responseText);
  } catch {
    console.error("Gemini JSON 파싱 실패:", responseText);
    // 파싱 실패 시 모든 영상을 '안전'으로 기본 처리
    parsed = videos.map((item) => ({
      video_id: item.id.videoId,
      status: "안전" as const,
      reason: "자동 분석을 완료하지 못했습니다.",
    }));
  }

  return parsed;
}

// ============================================
// Edge Function 핸들러
// ============================================

Deno.serve(async (req: Request) => {
  // CORS Preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // POST 요청만 허용
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 환경 변수 로드
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!youtubeApiKey || !geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "API keys not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 요청 본문 파싱
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "검색어(query)가 필요합니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. YouTube API로 상위 5개 영상 검색
    const youtubeItems = await fetchYouTubeVideos(query.trim(), youtubeApiKey);

    if (youtubeItems.length === 0) {
      return new Response(
        JSON.stringify({ videos: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Gemini AI로 안전성 분석
    const geminiResults = await analyzeWithGemini(youtubeItems, geminiApiKey);

    // Gemini 결과를 video_id 기준 Map으로 변환 (빠른 조회)
    const analysisMap = new Map<string, GeminiAnalysisItem>();
    for (const item of geminiResults) {
      analysisMap.set(item.video_id, item);
    }

    // 3. YouTube 메타데이터 + Gemini 분석 결과 병합
    const videos: VideoResult[] = youtubeItems.map((item) => {
      const videoId = item.id.videoId;
      const analysis = analysisMap.get(videoId);

      const thumbnail =
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.default?.url ??
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return {
        video_id: videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channel: item.snippet.channelTitle,
        thumbnail,
        status: analysis?.status ?? "안전",
        reason: analysis?.reason ?? "분석 결과 없음",
      };
    });

    // 4. 클라이언트에 반환
    return new Response(
      JSON.stringify({ videos }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("search-videos 오류:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
