import { AppConfig, sanitizeUserFacingMessage, validateTextInput, confirmCriticalAction } from "../../security/validate.js";
import {
  runSearch,
  saveSearchResults,
  loadSearchResults,
  buildBrowsePageUrl,
  setupCategoryTabs,
  YOUTUBE_CATEGORIES,
  NEWS_CATEGORIES,
  WELFARE_CATEGORIES,
  loadHomeYoutubeRecommendations,
  loadHomeNewsRecommendations,
  loadHomeWelfareInfo,
  bindWelfareCategoryReload
} from "../core.js";
import { initSiteChat } from "../chat.js";
import { ResultsModule } from "./results.js";

const homeDom = {
  get mobileMenuToggle() { return document.getElementById("mobile-menu-toggle"); },
  get mobileNav() { return document.getElementById("mobile-nav"); },
  get spaHomeLink() { return document.getElementById("spa-home-link"); },
  get viewHome() { return document.getElementById("view-home"); },
  get viewResults() { return document.getElementById("view-results"); },
  get searchForm() { return document.getElementById("search-form"); },
  get searchInput() { return document.getElementById("search-input"); },
  get youtubeContent() { return document.getElementById("youtube-content"); },
  get newsContent() { return document.getElementById("news-content"); },
  get resultsBackHome() { return document.getElementById("results-back-home"); },
  get loadingOverlay() { return document.getElementById("loading-overlay"); },
  get loadingMessage() { return document.getElementById("loading-message"); },
  get loadingCancel() { return document.getElementById("loading-cancel"); },
  get errorBox() { return document.getElementById("error-box"); },
  get errorMessage() { return document.getElementById("error-message"); },
  get errorClose() { return document.getElementById("error-close"); },
};

let searchInProgress = false;

export const ViewRouter = {
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

export const SearchModule = {
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

export const HomeModule = {
  initCategoryTabs() {
    const youtubeMore = document.getElementById("youtube-more");
    const newsMore = document.getElementById("news-more");
    const welfareMore = document.getElementById("welfare-more");

    setupCategoryTabs(
      document.getElementById("youtube-categories"),
      YOUTUBE_CATEGORIES,
      homeDom.youtubeContent,
      loadHomeYoutubeRecommendations,
      { onCategoryChange: (id) => NavigationUI.updateSectionMoreLink(youtubeMore, "youtube", id) },
    );

    setupCategoryTabs(
      document.getElementById("news-categories"),
      NEWS_CATEGORIES,
      homeDom.newsContent,
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

export function initHomePage() {
  ViewRouter.initFromLocation();
  HomeModule.initCategoryTabs();
  initSiteChat({
    onLinkResult: () => {
      ResultsModule.renderFromStorage();
      ViewRouter.showResults();
    },
  });
  bindHomeEvents();
}