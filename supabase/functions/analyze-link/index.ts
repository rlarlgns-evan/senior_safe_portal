/**
 * Supabase Edge Function: analyze-link
 * 링크 메타데이터 수집 + Gemini 피싱/스캠 분석 (GEMINI_API_KEY 서버 전용)
 *
 * 배포 방법 (택 1):
 *   A) CLI: supabase functions deploy analyze-link
 *   B) 대시보드(한 파일): supabase/deploy/analyze-link.ts 전체 붙여넣기
 *      (node scripts/bundle-edge-function.mjs analyze-link 실행 후)
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";
import {
  buildCorsHeaders,
  jsonResponse,
  sanitizePublicUrl,
  toClientSafeMessage,
} from "./security.ts";

type AnalysisResult = {
  status: "안전" | "위험";
  reason: string;
};

const MAX_HTML_BYTES = 512_000;
const FETCH_TIMEOUT_MS = 12_000;

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim().slice(0, 300) || "";
}

function extractMetaContent(html: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]*(?:name|property)=["']${escapedKey}["'][^>]*content=["']([\\s\\S]*?)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([\\s\\S]*?)["'][^>]*(?:name|property)=["']${escapedKey}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim().slice(0, 500);
  }

  return "";
}

function extractDescription(html: string): string {
  return extractMetaContent(html, "description")
    || extractMetaContent(html, "og:description")
    || extractMetaContent(html, "twitter:description");
}

function extractBestTitle(html: string): string {
  return extractTitle(html)
    || extractMetaContent(html, "og:title")
    || extractMetaContent(html, "twitter:title");
}

function extractThumbnail(html: string, baseUrl: string): string {
  const raw = extractMetaContent(html, "og:image")
    || extractMetaContent(html, "twitter:image")
    || extractMetaContent(html, "twitter:image:src");

  if (!raw) return "";

  try {
    const resolved = new URL(raw, baseUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) return "";
    return resolved.toString().slice(0, 2048);
  } catch {
    return "";
  }
}

function youtubeThumbnailFromUrl(targetUrl: string): string {
  const match = targetUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : "";
}

function faviconFromUrl(targetUrl: string): string {
  try {
    const host = new URL(targetUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`;
  } catch {
    return "";
  }
}

function resolveLinkThumbnail(targetUrl: string, scrapedThumbnail?: string): string {
  return scrapedThumbnail || youtubeThumbnailFromUrl(targetUrl) || faviconFromUrl(targetUrl);
}

/**
 * 공개 URL에서 HTML 메타데이터만 수집 (SSRF·대용량 응답 방지)
 */
async function scrapeUrlMetadata(targetUrl: string): Promise<{ title: string; description: string; thumbnail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SeniorDigitalSheriffBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error("링크 페이지를 불러오지 못했습니다.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("웹페이지(HTML) 형식이 아닌 링크입니다.");
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const title = extractBestTitle(html);
    const description = extractDescription(html);
    const thumbnail = extractThumbnail(html, targetUrl);

    if (!title && !description) {
      throw new Error("페이지에서 제목 또는 설명 정보를 찾지 못했습니다.");
    }

    return { title, description, thumbnail };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Gemini로 링크 위험도 분석
 */
async function analyzeWithGemini(
  title: string,
  description: string,
  targetUrl: string,
  apiKey: string,
  scrapeNote?: string,
): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const systemPrompt =
    'Analyze URL/title/description for senior-targeting phishing/scams. Return JSON: {"status":"안전"|"위험","reason":"Korean explanation"}.';

  const userPrompt = [
    `URL: ${targetUrl}`,
    `Title: ${title || "(없음)"}`,
    `Description: ${description || "(없음)"}`,
    scrapeNote ? `Note: ${scrapeNote.slice(0, 200)}` : "",
  ].filter(Boolean).join("\n");

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt },
  ]);

  let parsed: Partial<AnalysisResult>;
  try {
    parsed = JSON.parse(result.response.text()) as Partial<AnalysisResult>;
  } catch {
    throw new Error("AI 분석 결과를 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  return {
    status: parsed.status === "위험" ? "위험" : "안전",
    reason: (parsed.reason || "분석 이유를 확인하지 못했습니다.").slice(0, 400),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(req, { error: "Method not allowed" }, 405);
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.error("Missing GEMINI_API_KEY");
      return jsonResponse(req, {
        error: "분석 실패",
        message: "서버 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
      }, 503);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, {
        error: "분석 실패",
        message: "요청 형식이 올바르지 않습니다.",
      }, 400);
    }

    const targetUrl = sanitizePublicUrl(body?.url);

    let title = "";
    let description = "";
    let thumbnail = resolveLinkThumbnail(targetUrl);
    let scrapeNote: string | undefined;

    try {
      const scraped = await scrapeUrlMetadata(targetUrl);
      title = scraped.title;
      description = scraped.description;
      thumbnail = resolveLinkThumbnail(targetUrl, scraped.thumbnail);
    } catch (scrapeError) {
      scrapeNote = toClientSafeMessage(
        scrapeError,
        "페이지 정보를 가져오지 못했습니다.",
      );
    }

    const analysis = await analyzeWithGemini(title, description, targetUrl, geminiApiKey, scrapeNote);

    return jsonResponse(req, {
      ...analysis,
      scraped: {
        title,
        description,
        url: targetUrl,
        thumbnail,
        scrapeNote,
      },
    });
  } catch (error) {
    console.error("analyze-link error:", error);
    return jsonResponse(req, {
      error: "분석 실패",
      message: toClientSafeMessage(error, "링크 분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    }, 400);
  }
});
