#!/usr/bin/env node
/**
 * common.js → js/ 모듈 분할 (글로벌 스코프, GitHub Pages 호환)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "common.js");

function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trimStart() + "\n", "utf8");
  console.log("✓", rel);
}

const raw = fs.readFileSync(SRC, "utf8");

// common.js에서 bootstrap 제외 본문 추출 후 섹션별 분할
const bootstrapStart = raw.indexOf("document.addEventListener(\"DOMContentLoaded\"");

write("js/core/config.js", `/**
 * 앱 상수 · 카테고리 설정
 */
${extractBlock(raw, 4, 330)}

let cachedWelfareContext = null;
let welfareCategoryReload = null;
let cachedUserLocation = null;
`);

write("js/core/client.js", `/**
 * Supabase 클라이언트
 */
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
`);

write("js/core/utils.js", `/**
 * XSS-safe 유틸 · 입력 검증 · 오류 메시지 정제
 */
${extractFunctions(raw, [
  "mascotImg", "mascotLoadingHtml", "escapeHtml", "isLikelyUrl", "normalizeUrl",
  "getInvokeErrorMessage", "getYoutubeThumbnail", "getFaviconThumbnail",
  "resolveLinkThumbnail", "linkAnalysisToItem", "findCategoryById", "getCategoryQuery",
  "buildBrowsePageUrl", "getUserDisplayName",
])}

const AppConfig = Object.freeze({
  MAX_SEARCH_LENGTH: 500,
  MAX_CHAT_LENGTH: 2000,
  MAX_EMAIL_LENGTH: 254,
});

function sanitizeUserFacingMessage(error, fallback) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim().slice(0, 240);
  const sensitive = /api[_-]?key|AIza|Bearer\\s|stack| at \\w+\\(|deno\\.|supabase\\.co\\/functions/i;
  if (!message || sensitive.test(message)) return fallback;
  return message;
}

function validateTextInput(raw, maxLength, emptyMessage) {
  const cleaned = raw.replace(/[\\u0000-\\u001F\\u007F]/g, " ").replace(/\\s+/g, " ").trim();
  if (!cleaned) throw new Error(emptyMessage);
  if (cleaned.length > maxLength) throw new Error(\`입력은 \${maxLength}자 이내로 작성해 주세요.\`);
  return cleaned;
}

function validateEmailInput(email) {
  const trimmed = email.trim().slice(0, AppConfig.MAX_EMAIL_LENGTH);
  if (!trimmed || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(trimmed)) {
    throw new Error("올바른 이메일 주소를 입력해 주세요.");
  }
  return trimmed;
}
`);

write("js/core/storage.js", extractFunctions(raw, ["saveSearchResults", "loadSearchResults"]) + `

function goToResultsPage() {
  if (document.getElementById("view-results")) {
    window.location.hash = "results";
    if (typeof ResultsModule !== "undefined" && typeof ViewRouter !== "undefined") {
      ResultsModule.renderFromStorage();
      ViewRouter.showResults();
      return;
    }
  }
  window.location.href = "index.html#results";
}
`);

// Fallback: copy full common.js sections via regex for api/ui
const apiSearch = extractBetween(raw, "async function analyzeLink", "const YOUTUBE_CATEGORIES");
const youtubeBlock = extractBetween(raw, "const YOUTUBE_CATEGORIES", "const NEWS_CATEGORIES");
const newsBlock = extractBetween(raw, "const NEWS_CATEGORIES", "const DEFAULT_LOCATION");
const welfareBlock = extractBetween(raw, "function filterWelfareServices", "async function initBrowseWelfareLocation");
const weatherBlock = extractBetween(raw, "const DEFAULT_LOCATION", "async function runSearch");
const runSearchBlock = extractBetween(raw, "async function runSearch", "function saveSearchResults");
const chatBlock = extractFunctions(raw, ["chatWithAgent"]);

write("js/api/search.js", apiSearch + "\n" + runSearchBlock);
write("js/api/youtube.js", youtubeBlock);
write("js/api/news.js", extractBetween(raw, "async function searchNews", "const DEFAULT_LOCATION"));
write("js/api/welfare.js", "function bindWelfareCategoryReload(reloadFn) {\n  welfareCategoryReload = reloadFn;\n  if (cachedWelfareContext) reloadFn();\n}\n\n" + welfareBlock);
write("js/api/weather.js", weatherBlock);
write("js/api/chat.js", chatBlock);

write("js/ui/category-tabs.js", extractBetween(raw, "function setupCategoryTabs", "function renderVerifiedBadge"));
write("js/ui/cards.js", extractBetween(raw, "function renderVerifiedBadge", "async function fetchYoutubeItemsForCategory"));
write("js/ui/layout.js", extractBetween(raw, "function getSiteHeaderHtml", "function getUserDisplayName") + "\n" +
  extractBetween(raw, "function getSiteFooterHtml", "function buildNavLinksHtml") +
  extractBetween(raw, "function buildNavLinksHtml", "function initSiteWeather") +
  extractFunctions(raw, ["closeMobileNavMenu", "initSiteWeather"]));

write("js/ui/auth.js", extractBetween(raw, "function getLoginModalHtml", "function getSiteFooterHtml") +
  extractBetween(raw, "const SiteAuth = {", "function getSiteFooterHtml"));

write("js/bootstrap.js", `/**
 * 공통 부트스트랩 — 모든 페이지
 */
document.addEventListener("DOMContentLoaded", () => {
  injectSiteHeader();
  injectLoginModal();
  initSiteNavigation();
  SiteAuth.init();
  injectSiteFooter();
  initSiteWeather();

  const page = document.body.dataset.page;
  if (page === "home" && typeof initHomePage === "function") initHomePage();
  if (page === "browse" && typeof initBrowsePage === "function") initBrowsePage();
  if (page === "board" && typeof initBoardPage === "function") initBoardPage();
  if (page === "results-legacy" && typeof initResultsLegacyPage === "function") initResultsLegacyPage();
});
`);

function extractBlock(text, startLine, endLine) {
  return text.split("\n").slice(startLine - 1, endLine).join("\n");
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start === -1 || end === -1) return `/* missing: ${startMarker} */`;
  return text.slice(start, end).trim();
}

function extractFunctions(text, names) {
  const parts = [];
  for (const name of names) {
    const re = new RegExp(`(?:async )?function ${name}[\\s\\S]*?(?=\\n(?:async )?function |\\nconst |\\nlet |$)`, "m");
    const m = text.match(re);
    if (m) parts.push(m[0].trim());
  }
  return parts.join("\n\n");
}

console.log("\nDone. Review js/ output and update HTML script tags.");
