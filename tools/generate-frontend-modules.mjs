/**
 * sheriff-core.js → scripts/ ES module split (one-time generator)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "js/sheriff-core.js"), "utf8");
const utilsSrc = fs.readFileSync(path.join(root, "js/core/utils.js"), "utf8");
const chatSrc = fs.readFileSync(path.join(root, "js/chat.js"), "utf8");
const bootstrapSrc = fs.readFileSync(path.join(root, "js/bootstrap.js"), "utf8");

const pages = ["home", "browse", "board", "results"];

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel);
}

// ── config ──
write("scripts/config.js", `/** @file App-wide constants */
export const SUPABASE_URL = "https://oweduuhfkiutlszfwukt.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZWR1dWhma2l1dGxzemZ3dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjMyNzUsImV4cCI6MjA5NzUzOTI3NX0.n25pwv-WuWOBIGY7cwJCYj1TxILYpy2XA2nn7a6ySMY";
export const SEARCH_RESULTS_KEY = "sheriff-search-results";
export const MASCOT_SRC = "assets/mascot-sheriff.png";
export const MASCOT_POTATO_SRC = "assets/mascot-potato.png";

export const SITE_NAV_ITEMS = ${src.match(/const SITE_NAV_ITEMS = (\[[\s\S]*?\]);/)?.[1] ?? "[]"};

export const YOUTUBE_CATEGORIES = ${src.match(/const YOUTUBE_CATEGORIES = (\[[\s\S]*?\]);/)?.[1] ?? "[]"};
export const YOUTUBE_CATEGORY_FALLBACK = ${src.match(/const YOUTUBE_CATEGORY_FALLBACK = (\{[\s\S]*?\});/)?.[1] ?? "{}"};
export const NEWS_CATEGORIES = ${src.match(/const NEWS_CATEGORIES = (\[[\s\S]*?\]);/)?.[1] ?? "[]"};
export const WELFARE_CATEGORIES = ${src.match(/const WELFARE_CATEGORIES = (\[[\s\S]*?\]);/)?.[1] ?? "[]"};
export const WELFARE_CATEGORY_KEYWORDS = ${src.match(/const WELFARE_CATEGORY_KEYWORDS = (\{[\s\S]*?\});/)?.[1] ?? "{}"};

export const HOME_YOUTUBE_PREVIEW = 5;
export const HOME_NEWS_PREVIEW = 5;
export const HOME_WELFARE_PREVIEW = 5;
export const BROWSE_YOUTUBE_LIMIT = 20;
export const BROWSE_NEWS_LIMIT = 20;
export const BROWSE_WELFARE_LIMIT = 10;
export const YOUTUBE_CACHE_TTL_MS = 30 * 60 * 1000;
export const YOUTUBE_QUOTA_STORAGE_KEY = "sheriff-youtube-quota-date";

export const DEFAULT_LOCATION = {
  latitude: 37.5665,
  longitude: 126.9780,
  label: "서울",
};

export const ENGLISH_TO_KOREAN_REGION = ${src.match(/const ENGLISH_TO_KOREAN_REGION = (\{[\s\S]*?\});/)?.[1] ?? "{}"};
export const ENGLISH_TO_KOREAN_CITY = ${src.match(/const ENGLISH_TO_KOREAN_CITY = (\{[\s\S]*?\});/)?.[1] ?? "{}"};
`);

// ── security ──
write("scripts/security/sanitize.js", `${extractFunctions(src, ["escapeHtml", "decodeHtmlEntities", "sanitizeNewsText"]).replace(/^function /gm, "export function ")}

`);

write("scripts/security/url.js", `${extractFunctions(src, ["isLikelyUrl", "normalizeUrl"]).replace(/^function /gm, "export function ")}

`);

const validateBody = utilsSrc
  .replace(/\/\*\*[\s\S]*?\*\//, "")
  .replace(/^function /gm, "export function ")
  .replace(/normalizeUrl\(url\)/, "normalizeUrl(url)")
  .trim();

write("scripts/security/validate.js", `import { normalizeUrl } from "./url.js";

${validateBody}
`);

// ── api client ──
write("scripts/api/client.js", `import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
`);

write("scripts/api/errors.js", `${extractFunctions(src, ["getInvokeErrorMessage"]).replace(/^async function /gm, "export async function ")}

`);

// ── ui/core: remaining sheriff-core as ES module with imports ──
const coreBody = stripFromSource(src, [
  "const SUPABASE_URL",
  "const SUPABASE_ANON_KEY",
  "const SEARCH_RESULTS_KEY",
  "const MASCOT_SRC",
  "const MASCOT_POTATO_SRC",
  "const SITE_NAV_ITEMS",
  "const supabaseClient",
  "function escapeHtml",
  "function decodeHtmlEntities",
  "function sanitizeNewsText",
  "function isLikelyUrl",
  "function normalizeUrl",
  "async function getInvokeErrorMessage",
]);

write("scripts/ui/core.js", `/**
 * Core UI + data orchestration (split from sheriff-core.js)
 */
import { supabaseClient } from "../api/client.js";
import { getInvokeErrorMessage } from "../api/errors.js";
import {
  SEARCH_RESULTS_KEY,
  MASCOT_SRC,
  MASCOT_POTATO_SRC,
  SITE_NAV_ITEMS,
  YOUTUBE_CATEGORIES,
  YOUTUBE_CATEGORY_FALLBACK,
  NEWS_CATEGORIES,
  WELFARE_CATEGORIES,
  WELFARE_CATEGORY_KEYWORDS,
  HOME_YOUTUBE_PREVIEW,
  HOME_NEWS_PREVIEW,
  HOME_WELFARE_PREVIEW,
  BROWSE_YOUTUBE_LIMIT,
  BROWSE_NEWS_LIMIT,
  BROWSE_WELFARE_LIMIT,
  YOUTUBE_CACHE_TTL_MS,
  YOUTUBE_QUOTA_STORAGE_KEY,
  DEFAULT_LOCATION,
  ENGLISH_TO_KOREAN_REGION,
  ENGLISH_TO_KOREAN_CITY,
} from "../config.js";
import { escapeHtml, decodeHtmlEntities, sanitizeNewsText } from "../security/sanitize.js";
import { isLikelyUrl, normalizeUrl } from "../security/url.js";
import {
  AppConfig,
  sanitizeUserFacingMessage,
  validateTextInput,
  validateEmailInput,
  validatePasswordInput,
} from "../security/validate.js";

${coreBody}

export {
  mascotImg,
  mascotLoadingHtml,
  analyzeLink,
  searchVideos,
  isVideoSafe,
  videoResultToItem,
  getYoutubeSearchQueries,
  getYoutubeFallbackItems,
  padYoutubeItemsToCount,
  searchYoutubeQueryBatch,
  getTodayKstDate,
  loadYoutubeQuotaState,
  markYoutubeQuotaBlocked,
  buildYoutubeCacheKey,
  getCachedYoutubeItems,
  setCachedYoutubeItems,
  isYoutubeQuotaError,
  renderYoutubeQuotaNotice,
  buildBrowsePageUrl,
  findCategoryById,
  getCategoryQuery,
  bindWelfareCategoryReload,
  filterWelfareServices,
  setupCategoryTabs,
  renderVerifiedBadge,
  wrapContentCardGrid,
  renderYoutubeCard,
  renderNewsCard,
  fetchYoutubeFeedFromDb,
  fetchYoutubeItemsForCategory,
  renderYoutubeFeedFallbackNotice,
  loadHomeYoutubeRecommendations,
  renderYoutubeItems,
  searchNews,
  renderNewsHomeCard,
  loadHomeNewsRecommendations,
  requestUserLocation,
  weatherCodeToLabel,
  parseKoreanLocationFromGeo,
  normalizeKoreanRegionName,
  normalizeKoreanCityName,
  normalizeWelfareAreaName,
  filterLocalWelfareByRegion,
  formatWelfareLocationLabel,
  fetchLocationLabelDirect,
  fetchWeatherDirect,
  fetchWeather,
  fetchWelfareInfo,
  renderWelfareServiceCard,
  weatherCodeToIcon,
  renderWeatherWidget,
  renderWelfareQuickLinks,
  loadHomeWelfareInfo,
  initBrowseWelfareLocation,
  initHomeLocationServices,
  runSearch,
  saveSearchResults,
  loadSearchResults,
  goToResultsPage,
  chatWithAgent,
  getSiteHeaderHtml,
  injectSiteHeader,
  getAuthFieldHtml,
  getAuthSocialButtonsHtml,
  getLoginModalHtml,
  injectLoginModal,
  getUserDisplayName,
  getUserAvatarUrl,
  SiteAuth,
  getSiteFooterHtml,
  injectSiteFooter,
  buildNavLinksHtml,
  initSiteNavigation,
  closeMobileNavMenu,
  initSiteWeather,
  YOUTUBE_CATEGORIES,
  NEWS_CATEGORIES,
  WELFARE_CATEGORIES,
  cachedUserLocation,
};
`);

// chat module
const chatBody = chatSrc
  .replace(/\/\*\*[\s\S]*?\*\/\s*/, "")
  .trim();

write("scripts/ui/chat.js", `import { MASCOT_SRC, SEARCH_RESULTS_KEY } from "../config.js";
import { AppConfig, sanitizeUserFacingMessage, validateTextInput, validateLinkAnalysisUrl } from "../security/validate.js";
import {
  SiteAuth,
  getUserDisplayName,
  getUserAvatarUrl,
  chatWithAgent,
  saveSearchResults,
  linkAnalysisToItem,
} from "./core.js";

${chatBody.replace(/^function /gm, "export function ").replace(/^const SiteChat/gm, "export const SiteChat")}

export { initSiteChat, injectSiteChat };
`);

// pages
for (const page of pages) {
  let pageSrc = fs.readFileSync(path.join(root, `js/pages/${page}.js`), "utf8");
  pageSrc = pageSrc.replace(/\/\*\*[\s\S]*?\*\//, "").trim();
  const imports = buildPageImports(pageSrc);
  write(
    `scripts/ui/pages/${page}.js`,
    `${imports}\n\n${pageSrc.replace(/^function init(\w+)/gm, "export function init$1").replace(/^const (\w+Module|ViewRouter|ResultsModule|BROWSE_CONFIG)/gm, "export const $1")}`,
  );
}

// main.js
write("scripts/main.js", bootstrapSrc
  .replace(/\/\*\*[\s\S]*?\*\//, "")
  .replace(
    "document.addEventListener(\"DOMContentLoaded\", () => {",
    `import {
  injectSiteHeader,
  injectLoginModal,
  initSiteNavigation,
  SiteAuth,
  injectSiteFooter,
  initSiteWeather,
} from "./ui/core.js";
import { injectSiteChat, initSiteChat } from "./ui/chat.js";
import { initHomePage } from "./ui/pages/home.js";
import { initBrowsePage } from "./ui/pages/browse.js";
import { initBoardPage } from "./ui/pages/board.js";

document.addEventListener("DOMContentLoaded", () => {`,
  )
  .replace(/if \(page === "home" && typeof initHomePage === "function"\) initHomePage\(\);/, 'if (page === "home") initHomePage();')
  .replace(/if \(page === "browse" && typeof initBrowsePage === "function"\) \{/, 'if (page === "browse") {')
  .replace(/initBrowsePage\(\);\s+if/, "initBrowsePage();\n    if")
  .replace(/if \(page === "board" && typeof initBoardPage === "function"\) initBoardPage\(\);/, 'if (page === "board") initBoardPage();')
);

// public API barrel for pages that need ResultsModule on home
write("scripts/ui/pages/results.js", fs.readFileSync(path.join(root, "js/pages/results.js"), "utf8")
  .replace(/\/\*\*[\s\S]*?\*\//, "")
  .replace(/^const ResultsModule/gm, "import { escapeHtml } from \"../../security/sanitize.js\";\nimport { AppConfig, sanitizeUserFacingMessage, validateTextInput } from \"../../security/validate.js\";\nimport { runSearch, saveSearchResults, loadSearchResults } from \"../core.js\";\n\nexport const ResultsModule")
  .replace(/^function /gm, "export function ")
  .replace(/export export/g, "export"));

console.log("done");

function extractFunctions(source, names) {
  const chunks = [];
  for (const name of names) {
    const re = new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`, "m");
    const m = source.match(re);
    if (m) chunks.push(m[0]);
  }
  return chunks.join("\n\n");
}

function stripFromSource(source, prefixes) {
  return source
    .split("\n")
    .filter((line) => !prefixes.some((p) => line.startsWith(p)))
    .join("\n")
    .replace(/^\/\*\*[\s\S]*?\*\//, "")
    .trim();
}

function buildPageImports(pageSrc) {
  const lines = [
    'import { AppConfig, sanitizeUserFacingMessage, validateTextInput, confirmCriticalAction } from "../../security/validate.js";',
  ];
  if (/escapeHtml|ResultsModule|runSearch|loadSearchResults|saveSearchResults|buildBrowsePageUrl|setupCategoryTabs|YOUTUBE_CATEGORIES|loadHome|initSiteChat|mascotLoadingHtml|cachedUserLocation|initBrowseWelfareLocation|getUserDisplayName|SiteAuth|supabaseClient/.test(pageSrc)) {
    lines.push(`import {
  ${[
    pageSrc.includes("escapeHtml") ? "escapeHtml" : null,
    pageSrc.includes("runSearch") ? "runSearch" : null,
    pageSrc.includes("saveSearchResults") ? "saveSearchResults" : null,
    pageSrc.includes("loadSearchResults") ? "loadSearchResults" : null,
    pageSrc.includes("buildBrowsePageUrl") ? "buildBrowsePageUrl" : null,
    pageSrc.includes("setupCategoryTabs") ? "setupCategoryTabs" : null,
    pageSrc.includes("YOUTUBE_CATEGORIES") ? "YOUTUBE_CATEGORIES" : null,
    pageSrc.includes("NEWS_CATEGORIES") ? "NEWS_CATEGORIES" : null,
    pageSrc.includes("WELFARE_CATEGORIES") ? "WELFARE_CATEGORIES" : null,
    pageSrc.includes("loadHomeYoutubeRecommendations") ? "loadHomeYoutubeRecommendations" : null,
    pageSrc.includes("loadHomeNewsRecommendations") ? "loadHomeNewsRecommendations" : null,
    pageSrc.includes("loadHomeWelfareInfo") ? "loadHomeWelfareInfo" : null,
    pageSrc.includes("bindWelfareCategoryReload") ? "bindWelfareCategoryReload" : null,
    pageSrc.includes("mascotLoadingHtml") ? "mascotLoadingHtml" : null,
    pageSrc.includes("cachedUserLocation") ? "cachedUserLocation" : null,
    pageSrc.includes("initBrowseWelfareLocation") ? "initBrowseWelfareLocation" : null,
    pageSrc.includes("getUserDisplayName") ? "getUserDisplayName" : null,
    pageSrc.includes("SiteAuth") ? "SiteAuth" : null,
    pageSrc.includes("supabaseClient") ? "supabaseClient" : null,
  ].filter(Boolean).join(",\n  ")}
} from "../core.js";`);
  }
  if (pageSrc.includes("initSiteChat")) {
    lines.push('import { initSiteChat } from "../chat.js";');
  }
  if (pageSrc.includes("ResultsModule") && !pageSrc.startsWith("const ResultsModule")) {
    lines.push('import { ResultsModule } from "./results.js";');
  }
  return lines.join("\n");
}
