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
