/**
 * 유튜브 · 뉴스 · 복지정보 전체 보기 페이지
 */

const BROWSE_CONFIG = {
  youtube: {
    page: "youtube",
    title: "유튜브 전체 보기",
    subtitle: "안전 확인된 영상 썸네일",
    icon: "smart_display",
    categories: YOUTUBE_CATEGORIES,
    loadFn: loadHomeYoutubeRecommendations,
    homeHash: "#youtube-section",
  },
  news: {
    page: "news",
    title: "뉴스 전체 보기",
    subtitle: "오늘의 신뢰 뉴스",
    icon: "newspaper",
    categories: NEWS_CATEGORIES,
    loadFn: loadHomeNewsRecommendations,
    homeHash: "#news-section",
  },
  welfare: {
    page: "welfare",
    title: "복지정보 전체 보기",
    subtitle: "우리 지역 맞춤 복지 혜택",
    icon: "volunteer_activism",
    categories: WELFARE_CATEGORIES,
    loadFn: loadHomeWelfareInfo,
    homeHash: "#welfare-section",
  },
};

function getBrowseType() {
  return document.body.dataset.browse || "youtube";
}

function getInitialCategoryId(categories) {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("category");
  if (fromUrl && categories.some((cat) => cat.id === fromUrl)) {
    return fromUrl;
  }
  return categories[0].id;
}

async function initBrowsePage() {
  const type = getBrowseType();
  const config = BROWSE_CONFIG[type];
  if (!config) return;

  const tabsContainer = document.getElementById("browse-categories");
  const contentContainer = document.getElementById("browse-content");
  const initialCategoryId = getInitialCategoryId(config.categories);

  if (type === "welfare") {
    contentContainer.innerHTML = mascotLoadingHtml("위치 정보를 확인한 뒤 복지 정보를 불러옵니다...");
    try {
      await initBrowseWelfareLocation();
    } catch {
      contentContainer.innerHTML = mascotLoadingHtml("복지 정보를 불러오지 못했습니다.");
      return;
    }
  }

  async function startTabs(activeId) {
    const categories = config.categories;
    let currentId = activeId;
    let loading = false;

    function renderTabs() {
      tabsContainer.innerHTML = categories.map((cat) => `
        <button
          type="button"
          class="category-tab${cat.id === currentId ? " category-tab-active" : ""}"
          data-category="${cat.id}"
          role="tab"
          aria-selected="${cat.id === currentId}"
        >${escapeHtml(cat.label)}</button>
      `).join("");

      tabsContainer.querySelectorAll(".category-tab").forEach((button) => {
        button.addEventListener("click", async () => {
          const nextId = button.dataset.category;
          if (loading || nextId === currentId) return;

          currentId = nextId;
          const url = buildBrowsePageUrl(config.page, currentId);
          window.history.replaceState(null, "", url);
          renderTabs();
          await loadContent();
        });
      });
    }

    async function loadContent() {
      const category = findCategoryById(categories, currentId);
      if (!category) return;

      loading = true;
      tabsContainer.querySelectorAll(".category-tab").forEach((button) => {
        button.disabled = true;
      });

      try {
        const loadArg = type === "welfare" ? category.id : category.query;
        await config.loadFn(contentContainer, loadArg, { preview: false });
      } finally {
        loading = false;
        renderTabs();
      }
    }

    renderTabs();
    await loadContent();
    return loadContent;
  }

  const reloadContent = await startTabs(initialCategoryId);

  const locationButton = document.getElementById("browse-location-button");
  if (locationButton && type === "welfare") {
    locationButton.addEventListener("click", async () => {
      cachedUserLocation = null;
      contentContainer.innerHTML = mascotLoadingHtml("위치를 다시 확인하고 있습니다...");
      await initBrowseWelfareLocation(true);
      if (reloadContent) await reloadContent();
    });
  }
}

document.addEventListener("DOMContentLoaded", initBrowsePage);
