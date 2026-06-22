import { normalizeUrl } from "./url.js";

export const AppConfig = Object.freeze({
  MAX_SEARCH_LENGTH: 500,
  MAX_CHAT_LENGTH: 2000,
  MAX_EMAIL_LENGTH: 254,
});

export function sanitizeUserFacingMessage(error, fallback) {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim().slice(0, 240);
  const sensitive = /api[_-]?key|AIza|Bearer\s|stack| at \w+\(|deno\.|supabase\.co\/functions/i;
  const geminiBusy = /503|429|high demand|Service Unavailable|Resource exhausted/i;

  if (geminiBusy.test(message)) {
    return "AI 서비스 이용량이 많아 잠시 응답이 지연되고 있습니다. 1~2분 후 다시 시도해 주세요.";
  }

  if (/GoogleGenerativeAI|generativelanguage\.googleapis\.com/i.test(message)) {
    return fallback;
  }

  if (!message || sensitive.test(message)) return fallback;
  return message;
}

export function validateTextInput(raw, maxLength, emptyMessage) {
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) throw new Error(emptyMessage);
  if (cleaned.length > maxLength) {
    throw new Error(`입력은 ${maxLength}자 이내로 작성해 주세요.`);
  }

  return cleaned;
}

export function validateEmailInput(email) {
  const trimmed = email.trim().slice(0, AppConfig.MAX_EMAIL_LENGTH);
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("올바른 이메일 주소를 입력해 주세요.");
  }
  return trimmed;
}

export function validatePasswordInput(password, minLength = 6) {
  if (!password) throw new Error("비밀번호를 입력해 주세요.");
  if (password.length < minLength) {
    throw new Error(`비밀번호는 ${minLength}자 이상 입력해 주세요.`);
  }
  if (password.length > 72) {
    throw new Error("비밀번호가 너무 깁니다. 72자 이내로 입력해 주세요.");
  }
  return password;
}

export function validateLinkAnalysisUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return normalizeUrl(url);
  } catch {
    return null;
  }
}

export function confirmCriticalAction(message) {
  return window.confirm(message);
}
