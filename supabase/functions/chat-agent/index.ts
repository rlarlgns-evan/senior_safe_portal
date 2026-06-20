import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatRole = "user" | "assistant";
type HistoryItem = { role: ChatRole; content: string };

const SYSTEM_INSTRUCTION = `You are the "Senior Digital Sheriff" (시니어 디지털 보안관), a warm and trustworthy conversational agent for Korean seniors (60+).

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

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({
      history: history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
    });

    const result = await chat.sendMessage(userPrompt);
    const reply = result.response.text().trim();

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
    return new Response(
      JSON.stringify({
        error: "챗봇 오류",
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
