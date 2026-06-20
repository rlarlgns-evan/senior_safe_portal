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

function extractDescription(html: string): string {
  const doubleQuote = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i);
  if (doubleQuote?.[1]) {
    return doubleQuote[1].replace(/\s+/g, " ").trim();
  }

  const singleQuote = html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
  return singleQuote?.[1]?.replace(/\s+/g, " ").trim() || "";
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

async function scrapeUrlMetadata(targetUrl: string): Promise<{ title: string; description: string }> {
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "User-Agent": "SeniorDigitalSheriffBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`링크 페이지를 불러오지 못했습니다. (HTTP ${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error("웹페이지(HTML) 형식이 아닌 링크입니다.");
  }

  const html = await response.text();
  const title = extractTitle(html);
  const description = extractDescription(html);

  if (!title && !description) {
    throw new Error("페이지에서 제목 또는 설명 정보를 찾지 못했습니다.");
  }

  return { title, description };
}

async function analyzeWithGemini(title: string, description: string, targetUrl: string, apiKey: string): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const systemPrompt =
    "You are a Senior Digital Sheriff. Analyze the provided webpage title and description to determine if it is a phishing link, a scam, or fake news targeting seniors. Return a JSON object strictly in this format: {'status': '안전' or '위험', 'reason': 'Explain the reason clearly and simply in Korean.'}.";

  const userPrompt = `URL: ${targetUrl}\nTitle: ${title || "(없음)"}\nDescription: ${description || "(없음)"}`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt },
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text) as Partial<AnalysisResult>;

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
    const { title, description } = await scrapeUrlMetadata(targetUrl);
    const analysis = await analyzeWithGemini(title, description, targetUrl, geminiApiKey);

    return new Response(
      JSON.stringify({
        ...analysis,
        scraped: { title, description, url: targetUrl },
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
