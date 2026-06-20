// ── Supabase 대시보드 배포용 (자동 생성) ──
// 원본: supabase/functions/search-videos/index.ts + _shared/*
// node scripts/bundle-edge-function.mjs search-videos

/**
 * Edge Function 공통 보안 유틸리티
 * import: from "@shared/security.ts"
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://rlarlgns-evan.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8080",
];

export function resolveAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw?.trim()) return DEFAULT_ALLOWED_ORIGINS;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = resolveAllowedOrigins();
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/** API 키·스택 등 민감 정보가 섞인 오류 메시지를 사용자용으로 정제 */
export function toClientSafeMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim().slice(0, 240);
  const sensitivePattern = /api[_-]?key|AIza|Bearer\s|stack| at \w+\.|deno\.|supabase\.co\/functions\/v1/i;
  const geminiBusyPattern = /503|429|high demand|Service Unavailable|Resource exhausted/i;

  if (geminiBusyPattern.test(message)) {
    return "AI 서비스 이용량이 많아 잠시 응답이 지연되고 있습니다. 1~2분 후 다시 시도해 주세요.";
  }

  if (/GoogleGenerativeAI|generativelanguage\.googleapis\.com/i.test(message)) {
    return fallback;
  }

  if (!message || sensitivePattern.test(message)) {
    return fallback;
  }

  return message;
}

/** 검색어 입력 검증 (YouTube/Gemini용) */
export function sanitizeSearchQuery(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("검색어 형식이 올바르지 않습니다.");
  }

  const query = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

  if (!query) {
    throw new Error("검색어(query)가 필요합니다.");
  }

  if (query.length > 120) {
    throw new Error("검색어는 120자 이내로 입력해 주세요.");
  }

  return query;
}

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
  /^\[::1\]$/,
  /^metadata\.google\.internal$/i,
];

/** SSRF 방지: 공개 http(s) URL만 허용 */
export function sanitizePublicUrl(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("링크 주소가 비어 있습니다.");
  }

  if (raw.length > 2048) {
    throw new Error("링크 주소가 너무 깁니다.");
  }

  const withProtocol = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("올바른 링크 주소 형식이 아닙니다.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("http 또는 https 링크만 분석할 수 있습니다.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new Error("내부 네트워크 주소는 분석할 수 없습니다.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("인증 정보가 포함된 링크는 분석할 수 없습니다.");
  }

  return parsed.toString();
}

export function clampLimit(raw: unknown, fallback: number, max: number): number {
  const limit = Number(raw);
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.floor(limit), 1), max);
}
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

export const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export class GeminiUnavailableError extends Error {
  constructor() {
    super("AI 서비스 이용량이 많아 잠시 응답이 지연되고 있습니다. 1~2분 후 다시 시도해 주세요.");
    this.name = "GeminiUnavailableError";
  }
}

type ContentPart = { text: string };

export type GeminiModelOptions = {
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
};

type ChatHistoryItem = {
  role: string;
  parts: ContentPart[];
};

const MAX_RETRIES_PER_MODEL = 3;
const RETRY_BASE_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /503|429|500|Service Unavailable|high demand|Resource exhausted|overloaded|temporarily unavailable|Too Many Requests/i.test(message);
}

export function isGeminiModelUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /404|not found|NOT_FOUND|model.*not.*support/i.test(message);
}

async function runWithGeminiFallback<T>(
  run: (modelName: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (const modelName of GEMINI_MODEL_FALLBACKS) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const result = await run(modelName);
        if (modelName !== GEMINI_MODEL_FALLBACKS[0]) {
          console.warn(`Gemini fallback model used: ${modelName}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        if (isGeminiModelUnavailable(error)) break;
        if (!isRetryableGeminiError(error)) throw error;
        if (attempt < MAX_RETRIES_PER_MODEL - 1) {
          await sleep(RETRY_BASE_MS * (2 ** attempt) + Math.random() * 300);
        }
      }
    }
  }

  console.error("Gemini request failed after retries:", lastError);
  throw new GeminiUnavailableError();
}

export async function generateGeminiText(
  apiKey: string,
  modelOptions: GeminiModelOptions,
  parts: ContentPart[],
): Promise<string> {
  return runWithGeminiFallback(async (modelName) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName, ...modelOptions });
    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    if (!text) throw new Error("empty response");
    return text;
  });
}

export async function sendGeminiChatMessage(
  apiKey: string,
  modelOptions: GeminiModelOptions,
  history: ChatHistoryItem[],
  userMessage: string,
): Promise<string> {
  return runWithGeminiFallback(async (modelName) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName, ...modelOptions });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userMessage);
    const text = result.response.text().trim();
    if (!text) throw new Error("empty response");
    return text;
  });
}

/**
 * ⚠️ Supabase 대시보드 배포 시 이 파일(index.ts)을 붙여넣지 마세요!
 * 대시보드에는 아래 파일 전체를 복사해 붙여넣으세요:
 *   → supabase/deploy/search-videos.ts
 *
 * Supabase Edge Function: search-videos
 * YouTube 검색 + Gemini AI 안전 분석 (시크릿은 서버 환경 변수만 사용)
 *
 * 배포 방법:
 *   A) 대시보드: supabase/deploy/search-videos.ts 전체 붙여넣기
 *   B) CLI: supabase functions deploy search-videos (이 폴더 전체 업로드)
 */

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
  const videoData = videos.map((item) => ({
    video_id: item.id.videoId,
    title: item.snippet.title.slice(0, 300),
    description: item.snippet.description.slice(0, 500),
  }));

  const systemPrompt = resolveAnalysisPrompt(analysisMode);

  const rawText = await generateGeminiText(
    geminiApiKey,
    { generationConfig: { responseMimeType: "application/json" } },
    [{ text: systemPrompt }, { text: `Analyze:\n${JSON.stringify(videoData)}` }],
  );

  let parsed: GeminiAnalysisItem[];
  try {
    parsed = JSON.parse(rawText);
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
    const isGeminiBusy = error instanceof GeminiUnavailableError;
    return jsonResponse(req, {
      error: "검색 실패",
      message,
      ...(isQuota ? { code: "YOUTUBE_QUOTA_EXCEEDED" } : {}),
    }, isQuota ? 429 : isGeminiBusy ? 503 : 400);
  }
});
