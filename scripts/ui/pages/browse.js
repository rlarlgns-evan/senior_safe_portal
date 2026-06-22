import { AppConfig, sanitizeUserFacingMessage, validateTextInput, confirmCriticalAction } from "../../security/validate.js";
import {
  buildBrowsePageUrl,
  setupCategoryTabs,
  YOUTUBE_CATEGORIES,
  NEWS_CATEGORIES,
  WELFARE_CATEGORIES,
  loadHomeYoutubeRecommendations,
  loadHomeNewsRecommendations,
  loadHomeWelfareInfo,
  mascotLoadingHtml,
  resetCachedUserLocation,
  initBrowseWelfareLocation
} from "../core.js";

export const BROWSE_CONFIG = {
  youtube: {
    page: "youtube",
    categories: YOUTUBE_CATEGORIES,
    loadFn: loadHomeYoutubeRecommendations,
  },
  news: {
    page: "news",
    categories: NEWS_CATEGORIES,
    loadFn: loadHomeNewsRecommendations,
  },
  welfare: {
    page: "welfare",
    categories: WELFARE_CATEGORIES,
    loadFn: loadHomeWelfareInfo,
  },
};

function getBrowseType() {
  return document.body.dataset.browse || "youtube";
}

function getInitialCategoryId(categories) {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("category");
  if (fromUrl && categories.some((cat) => cat.id === fromUrl)) return fromUrl;
  return categories[0].id;
}

export async function initBrowsePage() {
  const type = getBrowseType();
  const config = BROWSE_CONFIG[type];
  if (!config) return;

  const tabsContainer = document.getElementById("browse-categories");
  const contentContainer = document.getElementById("browse-content");
  if (!tabsContainer || !contentContainer) return;

  if (type === "welfare") {
    contentContainer.innerHTML = mascotLoadingHtml("복지 정보를 불러오고 있습니다...");
    await initBrowseWelfareLocation();
  }

  const initialId = getInitialCategoryId(config.categories);

  setupCategoryTabs(
    tabsContainer,
    config.categories,
    contentContainer,
    (container, query, options) => {
      const loadArg = type === "welfare" ? options.categoryId : query;
      return config.loadFn(container, loadArg, { preview: false, categoryId: options.categoryId });
    },
    {
      preview: false,
      initialCategoryId: initialId,
      onCategoryChange: (categoryId) => {
        const url = buildBrowsePageUrl(config.page, categoryId);
        window.history.replaceState(null, "", url);
      },
    },
  );

  const locationButton = document.getElementById("browse-location-button");
  if (locationButton && type === "welfare") {
    locationButton.addEventListener("click", async () => {
      resetCachedUserLocation();
      contentContainer.innerHTML = mascotLoadingHtml("위치를 다시 확인하고 있습니다...");
      await initBrowseWelfareLocation(true);
      locationButton.focus();
    });
  }
}