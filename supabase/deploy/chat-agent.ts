// ── Supabase 대시보드 배포용 (자동 생성) ──
// 원본: supabase/functions/chat-agent/index.ts + _shared/*
// node scripts/bundle-edge-function.mjs chat-agent

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
 *   → supabase/deploy/chat-agent.ts
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatRole = "user" | "assistant";
type HistoryItem = { role: ChatRole; content: string };

const SYSTEM_INSTRUCTION = `You are "단디" (디지털 보안관), a warm and trustworthy conversational agent for Korean seniors (60+).
Your name is 단디. Introduce yourself as 디지털 보안관 단디 when appropriate.

Your job:
- Help seniors stay safe online: phishing, smishing, voice phishing, fake news, scam ads, suspicious links.
- Explain simply in Korean. Use short sentences. Be polite and reassuring.
- If the user shares suspicious text or a link, explain risks clearly and give practical next steps (do not click, call 112/1332, ask family, etc.).
- If link analysis data is provided, use it in your answer.
- You may also answer general digital life questions (smartphone, YouTube, kakao) in a senior-friendly way.
- Never ask for passwords, OTP codes, or bank account numbers.
- Keep replies concise: about 3-6 sentences unless the user asks for more.`;

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const bare = text.match(/(?:^|\s)([\w-]+\.(?:com|co\.kr|net|org|kr|go\.kr|or\.kr)(?:\/[^\s]*)?)/gi) ?? [];

  const normalized = new Set<string>();

  for (const raw of matches) {
    try {
      normalized.add(new URL(raw).toString());
    } catch {
      // ignore invalid URL
    }
  }

  for (const raw of bare) {
    const trimmed = raw.trim();
    try {
      normalized.add(new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).toString());
    } catch {
      // ignore invalid URL
    }
  }

  return [...normalized];
}

async function analyzeLinkViaFunction(
  url: string,
  authHeader: string | null,
  apiKeyHeader: string | null,
): Promise<{ status: string; reason: string; scraped?: Record<string, unknown> } | null> {
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://oweduuhfkiutlszfwukt.supabase.co";
  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-link`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey: apiKeyHeader ?? authHeader.replace(/^Bearer\s+/i, ""),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) return null;
  return await response.json();
}

function buildLinkContext(analyses: Array<{ url: string; result: { status: string; reason: string; scraped?: Record<string, unknown> } }>): string {
  if (analyses.length === 0) return "";

  return analyses.map(({ url, result }) => [
    `[링크 분석] ${url}`,
    `판정: ${result.status}`,
    `근거: ${result.reason}`,
    result.scraped?.title ? `페이지 제목: ${result.scraped.title}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

function sanitizeHistory(history: unknown): HistoryItem[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item): item is HistoryItem =>
      Boolean(item)
      && typeof item === "object"
      && (item.role === "user" || item.role === "assistant")
      && typeof item.content === "string"
      && item.content.trim().length > 0
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 2000),
    }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("서버에 GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      throw new Error("메시지가 비어 있습니다.");
    }

    const history = sanitizeHistory(body?.history);
    const authHeader = req.headers.get("Authorization");
    const apiKeyHeader = req.headers.get("apikey");

    const urls = extractUrls(message);
    const linkAnalyses: Array<{ url: string; result: { status: string; reason: string; scraped?: Record<string, unknown> } }> = [];

    for (const url of urls.slice(0, 2)) {
      const result = await analyzeLinkViaFunction(url, authHeader, apiKeyHeader);
      if (result?.status) {
        linkAnalyses.push({ url, result });
      }
    }

    const linkContext = buildLinkContext(linkAnalyses);
    const userPrompt = linkContext
      ? `${message}\n\n---\n아래는 시스템이 미리 수행한 링크 분석입니다. 답변에 반영하세요.\n${linkContext}`
      : message;

    const reply = await sendGeminiChatMessage(
      geminiApiKey,
      { systemInstruction: SYSTEM_INSTRUCTION },
      history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
      userPrompt,
    );

    if (!reply) {
      throw new Error("챗봇 응답을 생성하지 못했습니다.");
    }

    return new Response(
      JSON.stringify({
        reply,
        linkAnalysis: linkAnalyses.length === 1
          ? {
            url: linkAnalyses[0].url,
            status: linkAnalyses[0].result.status,
            reason: linkAnalyses[0].result.reason,
            scraped: linkAnalyses[0].result.scraped ?? null,
          }
          : linkAnalyses.length > 1
            ? linkAnalyses.map(({ url, result }) => ({
              url,
              status: result.status,
              reason: result.reason,
            }))
            : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const status = error instanceof GeminiUnavailableError ? 503 : 400;
    const fallback = status === 503
      ? "AI 서비스 이용량이 많아 잠시 응답이 지연되고 있습니다. 1~2분 후 다시 시도해 주세요."
      : "알 수 없는 오류가 발생했습니다.";

    return new Response(
      JSON.stringify({
        error: "챗봇 오류",
        message: error instanceof Error ? error.message : fallback,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
