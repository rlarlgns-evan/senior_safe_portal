/**
 * 시니어 디지털 보안관 — 홈 대시보드
 * @fileoverview XSS-safe DOM 조작, 지속형 알림, 단일 책임 모듈 구조
 */

/** @typedef {'user' | 'bot'} ChatSender */

const AppConfig = Object.freeze({
  MAX_SEARCH_LENGTH: 500,
  MAX_CHAT_LENGTH: 2000,
  MAX_EMAIL_LENGTH: 254,
});

// ── DOM 참조 ──

const dom = {
  mobileMenuToggle: document.getElementById("mobile-menu-toggle"),
  mobileNav: document.getElementById("mobile-nav"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  youtubeContent: document.getElementById("youtube-content"),
  newsContent: document.getElementById("news-content"),
  loadingOverlay: document.getElementById("loading-overlay"),
  loadingMessage: document.getElementById("loading-message"),
  loadingCancel: document.getElementById("loading-cancel"),
  errorBox: document.getElementById("error-box"),
  errorMessage: document.getElementById("error-message"),
  errorClose: document.getElementById("error-close"),
  chatWindow: document.getElementById("chat-window"),
  chatFab: document.getElementById("chat-fab"),
  chatClose: document.getElementById("chat-close"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  chatMessages: document.getElementById("chat-messages"),
  loginButton: document.getElementById("login-button"),
  logoutButton: document.getElementById("logout-button"),
  userGreeting: document.getElementById("user-greeting"),
  loginModal: document.getElementById("login-modal"),
  loginModalClose: document.getElementById("login-modal-close"),
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  loginError: document.getElementById("login-error"),
  loginErrorMessage: document.getElementById("login-error-message"),
  loginErrorClose: document.getElementById("login-error-close"),
  locationButton: document.getElementById("location-button"),
};

let searchInProgress = false;
/** @type {Array<{role: string, content: string}>} */
const chatHistory = [];

// ── Security helpers ──

/**
 * 사용자에게 표시할 오류 메시지 정제 (스택·API 키 노출 방지)
 * @param {unknown} error
 * @param {string} fallback
 * @returns {string}
 */
function sanitizeUserFacingMessage(error, fallback) {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim().slice(0, 240);
  const sensitive = /api[_-]?key|AIza|Bearer\s|stack| at \w+\(|deno\.|supabase\.co\/functions/i;

  if (!message || sensitive.test(message)) return fallback;
  return message;
}

/**
 * 검색/챗 입력값 검증
 * @param {string} raw
 * @param {number} maxLength
 * @param {string} emptyMessage
 * @returns {string}
 */
function validateTextInput(raw, maxLength, emptyMessage) {
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) throw new Error(emptyMessage);
  if (cleaned.length > maxLength) {
    throw new Error(`입력은 ${maxLength}자 이내로 작성해 주세요.`);
  }

  return cleaned;
}

/**
 * 이메일 형식 간단 검증
 * @param {string} email
 */
function validateEmailInput(email) {
  const trimmed = email.trim().slice(0, AppConfig.MAX_EMAIL_LENGTH);
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("올바른 이메일 주소를 입력해 주세요.");
  }
  return trimmed;
}

/**
 * 챗봇 링크 분석 결과 URL 검증
 * @param {unknown} url
 * @returns {string|null}
 */
function validateLinkAnalysisUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return normalizeUrl(url);
  } catch {
    return null;
  }
}

// ── Persistent Alert UI ──

/** @namespace AlertUI */
const AlertUI = {
  /**
   * 로딩 오버레이 표시 (자동 해제 없음 — 사용자가 취소해야 함)
   * @param {string} [message]
   */
  showLoading(message) {
    if (dom.loadingMessage && message) {
      dom.loadingMessage.textContent = message;
    }
    dom.loadingOverlay?.classList.remove("hidden");
    dom.loadingOverlay?.setAttribute("aria-hidden", "false");
  },

  /** 로딩 오버레이 숨김 */
  hideLoading() {
    dom.loadingOverlay?.classList.add("hidden");
    dom.loadingOverlay?.setAttribute("aria-hidden", "true");
    searchInProgress = false;
  },

  /**
   * 지속형 오류 알림 (닫기 버튼 필수)
   * @param {string} message
   */
  showError(message) {
    if (dom.errorMessage) dom.errorMessage.textContent = message;
    dom.errorBox?.classList.remove("hidden");
    dom.errorBox?.setAttribute("aria-hidden", "false");
    dom.errorClose?.focus();
  },

  hideError() {
    dom.errorBox?.classList.add("hidden");
    dom.errorBox?.setAttribute("aria-hidden", "true");
  },

  /**
   * @param {string} message
   */
  showLoginError(message) {
    if (dom.loginErrorMessage) dom.loginErrorMessage.textContent = message;
    dom.loginError?.classList.remove("hidden");
  },

  hideLoginError() {
    dom.loginError?.classList.add("hidden");
    if (dom.loginErrorMessage) dom.loginErrorMessage.textContent = "";
  },
};

// ── Mobile navigation ──

const NavigationUI = {
  closeMobileMenu() {
    dom.mobileNav?.classList.add("hidden");
    dom.mobileMenuToggle?.setAttribute("aria-expanded", "false");
  },

  toggleMobileMenu() {
    if (!dom.mobileNav) return;
    const willOpen = dom.mobileNav.classList.contains("hidden");
    dom.mobileNav.classList.toggle("hidden", !willOpen);
    dom.mobileMenuToggle?.setAttribute("aria-expanded", willOpen ? "true" : "false");
  },

  /**
   * @param {HTMLAnchorElement|null} linkEl
   * @param {string} page
   * @param {string} categoryId
   */
  updateSectionMoreLink(linkEl, page, categoryId) {
    if (!linkEl) return;
    linkEl.href = buildBrowsePageUrl(page, categoryId);
  },
};

// ── Auth ──

const AuthModule = {
  /**
   * @param {import('@supabase/supabase-js').User|null} user
   */
  updateAuthUI(user) {
    if (user) {
      const emailLocal = user.email?.split("@")[0] ?? "회원";
      const safeName = emailLocal.replace(/[^\w.\-가-힣]/g, "").slice(0, 32) || "회원";
      if (dom.userGreeting) dom.userGreeting.textContent = `${safeName}님`;
      dom.userGreeting?.classList.remove("hidden");
      dom.loginButton?.classList.add("hidden");
      dom.logoutButton?.classList.remove("hidden");
    } else {
      dom.userGreeting?.classList.add("hidden");
      dom.loginButton?.classList.remove("hidden");
      dom.logoutButton?.classList.add("hidden");
    }
  },

  async initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    AuthModule.updateAuthUI(session?.user ?? null);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      AuthModule.updateAuthUI(session?.user ?? null);
    });
  },

  openLoginModal() {
    AlertUI.hideLoginError();
    dom.loginModal?.classList.remove("hidden");
    dom.loginEmail?.focus();
  },

  closeLoginModal() {
    dom.loginModal?.classList.add("hidden");
    dom.loginForm?.reset();
    AlertUI.hideLoginError();
  },

  async handleLoginSubmit(event) {
    event.preventDefault();
    AlertUI.hideLoginError();

    try {
      const email = validateEmailInput(dom.loginEmail?.value ?? "");
      const password = dom.loginPassword?.value ?? "";

      if (!password) throw new Error("비밀번호를 입력해 주세요.");

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        AlertUI.showLoginError("로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
        return;
      }

      AuthModule.closeLoginModal();
    } catch (err) {
      AlertUI.showLoginError(sanitizeUserFacingMessage(err, "로그인 중 문제가 발생했습니다."));
    }
  },

  async handleLogout() {
    await supabaseClient.auth.signOut();
  },
};

// ── Search ──

const SearchModule = {
  /**
   * 검색 실행 후 결과 페이지로 이동
   * @param {SubmitEvent} event
   */
  async handleSearchSubmit(event) {
    event.preventDefault();
    if (searchInProgress) return;

    AlertUI.hideError();
    NavigationUI.closeMobileMenu();

    try {
      const query = validateTextInput(
        dom.searchInput?.value ?? "",
        AppConfig.MAX_SEARCH_LENGTH,
        "검색어 또는 링크를 입력해 주세요.",
      );

      searchInProgress = true;
      AlertUI.showLoading("안전 검사를 진행하고 있습니다. 잠시만 기다려주세요...");

      const payload = await runSearch(query);
      saveSearchResults(payload);
      goToResultsPage();
    } catch (err) {
      AlertUI.hideLoading();
      AlertUI.showError(sanitizeUserFacingMessage(err, "검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."));
    }
  },

  handleLoadingCancel() {
    AlertUI.hideLoading();
    AlertUI.showError("검사를 취소했습니다. 다시 검색해 주세요.");
  },
};

// ── Chat (XSS-safe: textContent + createElement only) ──

const ChatModule = {
  /**
   * 채팅 말풍선 추가 — 외부/LLM 텍스트는 textContent만 사용
   * @param {string} text
   * @param {ChatSender} sender
   * @returns {HTMLDivElement}
   */
  renderChatBubble(text, sender) {
    const row = document.createElement("div");
    row.className = sender === "bot"
      ? "chat-message-row chat-message-row--bot"
      : "chat-message-row chat-message-row--user";

    if (sender === "bot") {
      const avatar = document.createElement("img");
      avatar.src = MASCOT_SRC;
      avatar.alt = "";
      avatar.className = "chat-mascot-avatar";
      avatar.setAttribute("loading", "lazy");
      row.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = sender === "bot" ? "chat-bubble bot" : "chat-bubble user";
    bubble.textContent = String(text ?? "").slice(0, AppConfig.MAX_CHAT_LENGTH);
    row.appendChild(bubble);

    dom.chatMessages?.appendChild(row);
    if (dom.chatMessages) dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;

    return bubble;
  },

  /**
   * @param {boolean} isSubmitting
   */
  setSubmitting(isSubmitting) {
    const submitButton = dom.chatForm?.querySelector(".chat-submit");
    if (submitButton) {
      submitButton.disabled = isSubmitting;
      submitButton.textContent = isSubmitting ? "답변 생성 중..." : "메시지 보내기";
    }
    if (dom.chatInput) dom.chatInput.disabled = isSubmitting;
  },

  /** 링크 분석 결과 보기 버튼 (DOM API만 사용) */
  renderLinkResultAction() {
    const detailRow = document.createElement("div");
    detailRow.className = "chat-message-row chat-message-row--bot";

    const detailBubble = document.createElement("div");
    detailBubble.className = "chat-bubble bot chat-action";

    const resultButton = document.createElement("button");
    resultButton.type = "button";
    resultButton.className = "btn btn--primary";
    resultButton.textContent = "📋 상세 검사 결과 보기";
    resultButton.addEventListener("click", goToResultsPage);

    detailBubble.appendChild(resultButton);
    detailRow.appendChild(detailBubble);
    dom.chatMessages?.appendChild(detailRow);

    if (dom.chatMessages) dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  },

  /**
   * @param {SubmitEvent} event
   */
  async handleChatSubmit(event) {
    event.preventDefault();

    try {
      const text = validateTextInput(
        dom.chatInput?.value ?? "",
        AppConfig.MAX_CHAT_LENGTH,
        "메시지를 입력해 주세요.",
      );

      AlertUI.hideError();
      ChatModule.renderChatBubble(text, "user");
      if (dom.chatInput) dom.chatInput.value = "";
      chatHistory.push({ role: "user", content: text });

      const thinkingBubble = ChatModule.renderChatBubble("단디가 생각하고 있습니다...", "bot");
      ChatModule.setSubmitting(true);

      const data = await chatWithAgent(text, chatHistory.slice(0, -1));
      thinkingBubble.textContent = String(data.reply ?? "").slice(0, AppConfig.MAX_CHAT_LENGTH);
      chatHistory.push({ role: "assistant", content: data.reply });

      if (data.linkAnalysis && !Array.isArray(data.linkAnalysis)) {
        const safeUrl = validateLinkAnalysisUrl(data.linkAnalysis.url);

        if (safeUrl) {
          const payload = {
            query: safeUrl,
            type: "link",
            summary: data.linkAnalysis.status === "위험"
              ? "⚠️ 챗봇 링크 검사 · 위험 신호 감지"
              : "✅ 챗봇 링크 검사 · 비교적 안전",
            items: [linkAnalysisToItem(data.linkAnalysis, safeUrl)],
          };
          saveSearchResults(payload);
          ChatModule.renderLinkResultAction();
        }
      }
    } catch (err) {
      chatHistory.pop();
      const lastBotRow = dom.chatMessages?.querySelector(".chat-message-row--bot:last-child .chat-bubble");
      if (lastBotRow) {
        lastBotRow.textContent = sanitizeUserFacingMessage(
          err,
          "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      ChatModule.setSubmitting(false);
    }
  },

  toggleChatWindow() {
    dom.chatWindow?.classList.toggle("hidden");
    if (dom.chatWindow && !dom.chatWindow.classList.contains("hidden")) {
      dom.chatInput?.focus();
    }
  },

  closeChatWindow() {
    dom.chatWindow?.classList.add("hidden");
  },
};

// ── Home content bootstrap ──

const HomeModule = {
  initCategoryTabs() {
    const youtubeMore = document.getElementById("youtube-more");
    const newsMore = document.getElementById("news-more");
    const welfareMore = document.getElementById("welfare-more");

    setupCategoryTabs(
      document.getElementById("youtube-categories"),
      YOUTUBE_CATEGORIES,
      dom.youtubeContent,
      loadHomeYoutubeRecommendations,
      { onCategoryChange: (id) => NavigationUI.updateSectionMoreLink(youtubeMore, "youtube", id) },
    );

    setupCategoryTabs(
      document.getElementById("news-categories"),
      NEWS_CATEGORIES,
      dom.newsContent,
      loadHomeNewsRecommendations,
      { onCategoryChange: (id) => NavigationUI.updateSectionMoreLink(newsMore, "news", id) },
    );

    bindWelfareCategoryReload(
      setupCategoryTabs(
        document.getElementById("welfare-categories"),
        WELFARE_CATEGORIES,
        document.getElementById("welfare-content"),
        (container, query, options) => loadHomeWelfareInfo(container, query, options),
        { onCategoryChange: (id) => NavigationUI.updateSectionMoreLink(welfareMore, "welfare", id) },
      ).reload,
    );
  },

  initLocationServices() {
    dom.locationButton?.addEventListener("click", () => {
      cachedUserLocation = null;
      initHomeLocationServices(true);
    });
  },
};

// ── Event bindings & boot ──

function bindEvents() {
  dom.searchForm?.addEventListener("submit", (e) => SearchModule.handleSearchSubmit(e));
  dom.loadingCancel?.addEventListener("click", () => SearchModule.handleLoadingCancel());
  dom.errorClose?.addEventListener("click", () => AlertUI.hideError());
  dom.chatFab?.addEventListener("click", () => ChatModule.toggleChatWindow());
  dom.chatClose?.addEventListener("click", () => ChatModule.closeChatWindow());
  dom.chatForm?.addEventListener("submit", (e) => ChatModule.handleChatSubmit(e));
}

/**
 * 앱 초기화
 */
function initApp() {
  applyWeatherBackground(null);
  HomeModule.initCategoryTabs();
  HomeModule.initLocationServices();
  initHomeLocationServices();
  ChatModule.renderChatBubble(
    "안녕하세요! 저는 디지털 보안관 단디예요. 의심스러운 문자, 링크, 전화 사기 등 무엇이든 편하게 물어보세요.",
    "bot",
  );
  bindEvents();

  if (new URLSearchParams(location.search).get("consult") === "1") {
    dom.chatWindow?.classList.remove("hidden");
    dom.chatInput?.focus();
  }
}

document.addEventListener("DOMContentLoaded", initApp);
