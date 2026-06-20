import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AnalysisResult = {
  status: "안전" | "위험";
  reason: string;
};

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function extractMetaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*(?:name|property)=["']${key}["'][^>]*content=["']([\\s\\S]*?)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([\\s\\S]*?)["'][^>]*(?:name|property)=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
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
    return new URL(raw, baseUrl).toString();
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
    return `https://www.google.com/s2/favicons?domain=${host}&sz=256`;
  } catch {
    return "";
  }
}

function resolveLinkThumbnail(targetUrl: string, scrapedThumbnail?: string): string {
  return scrapedThumbnail
    || youtubeThumbnailFromUrl(targetUrl)
    || faviconFromUrl(targetUrl);
}

function normalizeUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("링크 주소가 비어 있습니다.");
  }

  const withProtocol = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  const parsed = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("http 또는 https 링크만 분석할 수 있습니다.");
  }

  return parsed.toString();
}

async function scrapeUrlMetadata(targetUrl: string): Promise<{ title: string; description: string; thumbnail: string }> {
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SeniorDigitalSheriffBot/1.0)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`링크 페이지를 불러오지 못했습니다. (HTTP ${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error("웹페이지(HTML) 형식이 아닌 링크입니다.");
  }

  const html = await response.text();
  const title = extractBestTitle(html);
  const description = extractDescription(html);
  const thumbnail = extractThumbnail(html, targetUrl);

  if (!title && !description) {
    throw new Error("페이지에서 제목 또는 설명 정보를 찾지 못했습니다.");
  }

  return { title, description, thumbnail };
}

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
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const systemPrompt =
    "You are a Senior Digital Sheriff. Analyze the provided webpage URL, title, and description to determine if it is a phishing link, a scam, or fake news targeting seniors. Return a JSON object strictly in this format: {\"status\": \"안전\" or \"위험\", \"reason\": \"Explain the reason clearly and simply in Korean.\"}.";

  const userPrompt = [
    `URL: ${targetUrl}`,
    `Title: ${title || "(없음)"}`,
    `Description: ${description || "(없음)"}`,
    scrapeNote ? `Scrape note: ${scrapeNote}` : "",
    "If page metadata is missing, analyze the URL pattern, domain reputation, and common senior-targeting scam signals.",
  ].filter(Boolean).join("\n");

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt },
  ]);

  const text = result.response.text();
  let parsed: Partial<AnalysisResult>;

  try {
    parsed = JSON.parse(text) as Partial<AnalysisResult>;
  } catch {
    throw new Error("AI 분석 결과를 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  return {
    status: parsed.status === "위험" ? "위험" : "안전",
    reason: parsed.reason || "분석 이유를 확인하지 못했습니다.",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("서버에 GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    const body = await req.json();
    const targetUrl = normalizeUrl(body?.url);

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
      scrapeNote = scrapeError instanceof Error
        ? scrapeError.message
        : "페이지 정보를 가져오지 못했습니다.";
    }

    const analysis = await analyzeWithGemini(title, description, targetUrl, geminiApiKey, scrapeNote);

    return new Response(
      JSON.stringify({
        ...analysis,
        scraped: { title, description, url: targetUrl, thumbnail, scrapeNote },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "분석 실패",
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
