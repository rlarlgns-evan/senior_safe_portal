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
