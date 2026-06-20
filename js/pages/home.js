/**
 * 홈 SPA — ViewRouter · 검색 · 챗봇
 */

/** @typedef {'user' | 'bot'} ChatSender */

const homeDom = {
  mobileMenuToggle: document.getElementById("mobile-menu-toggle"),
  mobileNav: document.getElementById("mobile-nav"),
  spaHomeLink: document.getElementById("spa-home-link"),
  viewHome: document.getElementById("view-home"),
  viewResults: document.getElementById("view-results"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  youtubeContent: document.getElementById("youtube-content"),
  newsContent: document.getElementById("news-content"),
  resultsBackHome: document.getElementById("results-back-home"),
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
};

let searchInProgress = false;
/** @type {Array<{role: string, content: string}>} */
const chatHistory = [];

const ViewRouter = {
  current: "home",

  show(viewId) {
    const views = { home: homeDom.viewHome, results: homeDom.viewResults };

    Object.entries(views).forEach(([id, element]) => {
      if (!element) return;
      const isActive = id === viewId;
      element.classList.toggle("hidden", !isActive);
      element.classList.toggle("app-view--active", isActive);
      element.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    this.current = viewId;
    NavigationUI.closeMobileMenu();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });

    const nextHash = viewId === "results" ? "#results" : "";
    const nextUrl = `${window.location.pathname}${nextHash}`;
    if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
      history.replaceState({ view: viewId }, "", nextUrl);
    }
  },

  showHome() { this.show("home"); },
  showResults() { this.show("results"); },

  initFromLocation() {
    if (window.location.hash === "#results" && loadSearchResults()) {
      ResultsModule.renderFromStorage();
      this.showResults();
      return;
    }
    this.showHome();
  },
};

const AlertUI = {
  showLoading(message) {
    if (homeDom.loadingMessage && message) homeDom.loadingMessage.textContent = message;
    homeDom.loadingOverlay?.classList.remove("hidden");
    homeDom.loadingOverlay?.setAttribute("aria-hidden", "false");
  },

  hideLoading() {
    homeDom.loadingOverlay?.classList.add("hidden");
    homeDom.loadingOverlay?.setAttribute("aria-hidden", "true");
    searchInProgress = false;
  },

  showError(message) {
    if (homeDom.errorMessage) homeDom.errorMessage.textContent = message;
    homeDom.errorBox?.classList.remove("hidden");
    homeDom.errorBox?.setAttribute("aria-hidden", "false");
    homeDom.errorClose?.focus();
  },

  hideError() {
    homeDom.errorBox?.classList.add("hidden");
    homeDom.errorBox?.setAttribute("aria-hidden", "true");
  },
};

const NavigationUI = {
  closeMobileMenu() {
    homeDom.mobileNav?.classList.add("hidden");
    homeDom.mobileMenuToggle?.setAttribute("aria-expanded", "false");
  },

  updateSectionMoreLink(linkEl, page, categoryId) {
    if (!linkEl) return;
    linkEl.href = buildBrowsePageUrl(page, categoryId);
  },
};

const SearchModule = {
  async handleSearchSubmit(event) {
    event.preventDefault();
    if (searchInProgress) return;

    AlertUI.hideError();
    NavigationUI.closeMobileMenu();

    try {
      const query = validateTextInput(
        homeDom.searchInput?.value ?? "",
        AppConfig.MAX_SEARCH_LENGTH,
        "검색어 또는 링크를 입력해 주세요.",
      );

      searchInProgress = true;
      AlertUI.showLoading("안전 검사를 진행하고 있습니다. 잠시만 기다려주세요...");

      const payload = await runSearch(query);
      saveSearchResults(payload);
      AlertUI.hideLoading();
      ResultsModule.render(payload);
      ViewRouter.showResults();
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

function formatChatTime(date = new Date()) {
  return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
}

const ChatModule = {
  renderChatBubble(text, sender, options = {}) {
    const row = document.createElement("div");
    row.className = sender === "bot"
      ? "chat-message-row chat-message-row--bot"
      : "chat-message-row chat-message-row--user";

    const content = document.createElement("div");
    content.className = "chat-message-content";

    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = formatChatTime();

    const bubble = document.createElement("div");
    bubble.className = sender === "bot"
      ? `chat-bubble bot${options.featured ? " chat-bubble--featured" : ""}`
      : "chat-bubble user";
    bubble.textContent = String(text ?? "").slice(0, AppConfig.MAX_CHAT_LENGTH);

    if (sender === "bot") {
      const avatar = document.createElement("img");
      avatar.src = MASCOT_SRC;
      avatar.alt = "";
      avatar.className = "chat-mascot-avatar";
      avatar.setAttribute("loading", "lazy");
      content.appendChild(time);
      content.appendChild(bubble);
      row.appendChild(avatar);
      row.appendChild(content);
    } else {
      const userAvatar = document.createElement("div");
      userAvatar.className = "chat-user-avatar";
      userAvatar.setAttribute("aria-hidden", "true");
      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined";
      icon.textContent = "person";
      userAvatar.appendChild(icon);
      content.appendChild(bubble);
      content.appendChild(time);
      row.appendChild(content);
      row.appendChild(userAvatar);
    }

    homeDom.chatMessages?.appendChild(row);
    if (homeDom.chatMessages) homeDom.chatMessages.scrollTop = homeDom.chatMessages.scrollHeight;

    return bubble;
  },

  setSubmitting(isSubmitting) {
    const submitButton = homeDom.chatForm?.querySelector(".chat-send-btn");
    if (submitButton) submitButton.disabled = isSubmitting;
    if (homeDom.chatInput) homeDom.chatInput.disabled = isSubmitting;
  },

  renderLinkResultAction() {
    const detailRow = document.createElement("div");
    detailRow.className = "chat-message-row chat-message-row--bot";

    const avatar = document.createElement("img");
    avatar.src = MASCOT_SRC;
    avatar.alt = "";
    avatar.className = "chat-mascot-avatar";
    avatar.setAttribute("loading", "lazy");

    const content = document.createElement("div");
    content.className = "chat-message-content";

    const detailBubble = document.createElement("div");
    detailBubble.className = "chat-bubble bot chat-action";

    const resultButton = document.createElement("button");
    resultButton.type = "button";
    resultButton.className = "chat-action-btn";
    resultButton.textContent = "📋 상세 검사 결과 보기";
    resultButton.addEventListener("click", () => {
      ResultsModule.renderFromStorage();
      ViewRouter.showResults();
    });

    detailBubble.appendChild(resultButton);
    content.appendChild(detailBubble);
    detailRow.appendChild(avatar);
    detailRow.appendChild(content);
    homeDom.chatMessages?.appendChild(detailRow);

    if (homeDom.chatMessages) homeDom.chatMessages.scrollTop = homeDom.chatMessages.scrollHeight;
  },

  sendSuggestion(text) {
    if (!homeDom.chatInput || ChatModule.isBusy()) return;
    homeDom.chatInput.value = text;
    homeDom.chatForm?.requestSubmit();
  },

  isBusy() {
    return Boolean(homeDom.chatForm?.querySelector(".chat-send-btn:disabled"));
  },

  async handleChatSubmit(event) {
    event.preventDefault();

    try {
      const text = validateTextInput(
        homeDom.chatInput?.value ?? "",
        AppConfig.MAX_CHAT_LENGTH,
        "메시지를 입력해 주세요.",
      );

      AlertUI.hideError();
      ChatModule.renderChatBubble(text, "user");
      if (homeDom.chatInput) homeDom.chatInput.value = "";
      chatHistory.push({ role: "user", content: text });

      const thinkingBubble = ChatModule.renderChatBubble("단디가 생각하고 있습니다...", "bot");
      ChatModule.setSubmitting(true);

      const data = await chatWithAgent(text, chatHistory.slice(0, -1));
      thinkingBubble.textContent = String(data.reply ?? "").slice(0, AppConfig.MAX_CHAT_LENGTH);
      chatHistory.push({ role: "assistant", content: data.reply });

      if (data.linkAnalysis && !Array.isArray(data.linkAnalysis)) {
        const safeUrl = validateLinkAnalysisUrl(data.linkAnalysis.url);

        if (safeUrl) {
          saveSearchResults({
            query: safeUrl,
            type: "link",
            summary: data.linkAnalysis.status === "위험"
              ? "⚠️ 챗봇 링크 검사 · 위험 신호 감지"
              : "✅ 챗봇 링크 검사 · 비교적 안전",
            items: [linkAnalysisToItem(data.linkAnalysis, safeUrl)],
          });
          ChatModule.renderLinkResultAction();
        }
      }
    } catch (err) {
      chatHistory.pop();
      const lastBotRow = homeDom.chatMessages?.querySelector(".chat-message-row--bot:last-child .chat-bubble");
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
    homeDom.chatWindow?.classList.toggle("hidden");
    if (homeDom.chatWindow && !homeDom.chatWindow.classList.contains("hidden")) {
      homeDom.chatInput?.focus();
    }
  },

  closeChatWindow() {
    homeDom.chatWindow?.classList.add("hidden");
  },
};

const HomeModule = {
  initCategoryTabs() {
    const youtubeMore = document.getElementById("youtube-more");
    const newsMore = document.getElementById("news-more");
    const welfareMore = document.getElementById("welfare-more");

    const tabAutoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const homeTabOptions = { autoRotate: tabAutoRotate, autoRotateMs: 5000 };

    setupCategoryTabs(
      document.getElementById("youtube-categories"),
      YOUTUBE_CATEGORIES,
      homeDom.youtubeContent,
      loadHomeYoutubeRecommendations,
      { ...homeTabOptions, onCategoryChange: (id) => NavigationUI.updateSectionMoreLink(youtubeMore, "youtube", id) },
    );

    setupCategoryTabs(
      document.getElementById("news-categories"),
      NEWS_CATEGORIES,
      homeDom.newsContent,
      loadHomeNewsRecommendations,
      { ...homeTabOptions, onCategoryChange: (id) => NavigationUI.updateSectionMoreLink(newsMore, "news", id) },
    );

    bindWelfareCategoryReload(
      setupCategoryTabs(
        document.getElementById("welfare-categories"),
        WELFARE_CATEGORIES,
        document.getElementById("welfare-content"),
        (container, query, options) => loadHomeWelfareInfo(container, query, options),
        { ...homeTabOptions, onCategoryChange: (id) => NavigationUI.updateSectionMoreLink(welfareMore, "welfare", id) },
      ).reload,
    );
  },
};

function bindHomeEvents() {
  homeDom.spaHomeLink?.addEventListener("click", (event) => {
    if (ViewRouter.current !== "home") {
      event.preventDefault();
      ViewRouter.showHome();
    }
  });

  homeDom.resultsBackHome?.addEventListener("click", () => ViewRouter.showHome());
  homeDom.searchForm?.addEventListener("submit", (e) => SearchModule.handleSearchSubmit(e));
  homeDom.loadingCancel?.addEventListener("click", () => SearchModule.handleLoadingCancel());
  homeDom.errorClose?.addEventListener("click", () => AlertUI.hideError());
  homeDom.chatFab?.addEventListener("click", () => ChatModule.toggleChatWindow());
  homeDom.chatClose?.addEventListener("click", () => ChatModule.closeChatWindow());
  homeDom.chatForm?.addEventListener("submit", (e) => ChatModule.handleChatSubmit(e));

  document.querySelectorAll("[data-chat-prompt]").forEach((chip) => {
    chip.addEventListener("click", () => ChatModule.sendSuggestion(chip.dataset.chatPrompt || ""));
  });

  ResultsModule.bindEvents();

  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#results" && loadSearchResults()) {
      ResultsModule.renderFromStorage();
      ViewRouter.showResults();
    } else if (!window.location.hash) {
      ViewRouter.showHome();
    }
  });
}

function initHomePage() {
  ViewRouter.initFromLocation();
  HomeModule.initCategoryTabs();
  ChatModule.renderChatBubble(
    "안녕하세요! 저는 디지털 보안관 단디예요. 의심스러운 문자, 링크, 전화 사기 등 무엇이든 편하게 물어보세요.",
    "bot",
    { featured: true },
  );
  bindHomeEvents();

  if (new URLSearchParams(location.search).get("consult") === "1") {
    homeDom.chatWindow?.classList.remove("hidden");
    homeDom.chatInput?.focus();
  }
}
