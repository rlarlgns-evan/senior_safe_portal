/**
 * 유튜브 · 뉴스 · 복지 전체 보기
 */

const BROWSE_CONFIG = {
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

async function initBrowsePage() {
  const type = getBrowseType();
  const config = BROWSE_CONFIG[type];
  if (!config) return;

  const tabsContainer = document.getElementById("browse-categories");
  const contentContainer = document.getElementById("browse-content");
  if (!tabsContainer || !contentContainer) return;

  if (type === "welfare") {
    contentContainer.innerHTML = mascotLoadingHtml("위치 정보를 확인한 뒤 복지 정보를 불러옵니다...");
    try {
      await initBrowseWelfareLocation();
    } catch {
      contentContainer.innerHTML = mascotLoadingHtml("복지 정보를 불러오지 못했습니다.");
      return;
    }
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
      cachedUserLocation = null;
      contentContainer.innerHTML = mascotLoadingHtml("위치를 다시 확인하고 있습니다...");
      await initBrowseWelfareLocation(true);
      locationButton.focus();
    });
  }
}
