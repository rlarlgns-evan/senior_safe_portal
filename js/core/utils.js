/**
 * XSS-safe 유틸 · 입력 검증 · 사용자용 오류 메시지
 */

const AppConfig = Object.freeze({
  MAX_SEARCH_LENGTH: 500,
  MAX_CHAT_LENGTH: 2000,
  MAX_EMAIL_LENGTH: 254,
});

function sanitizeUserFacingMessage(error, fallback) {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim().slice(0, 240);
  const sensitive = /api[_-]?key|AIza|Bearer\s|stack| at \w+\(|deno\.|supabase\.co\/functions/i;

  if (!message || sensitive.test(message)) return fallback;
  return message;
}

function validateTextInput(raw, maxLength, emptyMessage) {
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) throw new Error(emptyMessage);
  if (cleaned.length > maxLength) {
    throw new Error(`입력은 ${maxLength}자 이내로 작성해 주세요.`);
  }

  return cleaned;
}

function validateEmailInput(email) {
  const trimmed = email.trim().slice(0, AppConfig.MAX_EMAIL_LENGTH);
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("올바른 이메일 주소를 입력해 주세요.");
  }
  return trimmed;
}

function validatePasswordInput(password, minLength = 6) {
  if (!password) throw new Error("비밀번호를 입력해 주세요.");
  if (password.length < minLength) {
    throw new Error(`비밀번호는 ${minLength}자 이상 입력해 주세요.`);
  }
  if (password.length > 72) {
    throw new Error("비밀번호가 너무 깁니다. 72자 이내로 입력해 주세요.");
  }
  return password;
}

function validateLinkAnalysisUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return normalizeUrl(url);
  } catch {
    return null;
  }
}

function confirmCriticalAction(message) {
  return window.confirm(message);
}
