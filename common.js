/**
 * 시니어 디지털 보안관 - 공통 유틸 / 검색 로직
 */

const SUPABASE_URL = "https://oweduuhfkiutlszfwukt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZWR1dWhma2l1dGxzemZ3dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjMyNzUsImV4cCI6MjA5NzUzOTI3NX0.n25pwv-WuWOBIGY7cwJCYj1TxILYpy2XA2nn7a6ySMY";
const SEARCH_RESULTS_KEY = "sheriff-search-results";
const MASCOT_SRC = "assets/mascot-sheriff.png";
const MASCOT_POTATO_SRC = "assets/mascot-potato.png";

/** 상단 네비게이션 (전용 페이지로 이동) */
const SITE_NAV_ITEMS = [
  { id: "home", href: "index.html", label: "홈" },
  { id: "youtube", href: "youtube.html", label: "유튜브" },
  { id: "news", href: "news.html", label: "뉴스" },
  { id: "welfare", href: "welfare.html", label: "복지정보" },
  { id: "info", href: "community.html", label: "정보" },
  { id: "board", href: "board.html", label: "게시판" },
];

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function mascotImg(className, alt = "디지털 보안관 마스코트") {
  return `<img src="${MASCOT_SRC}" alt="${escapeHtml(alt)}" class="${className}" loading="lazy" />`;
}

function mascotLoadingHtml(message) {
  return `
    <div class="loading-with-mascot youtube-loading">
      ${mascotImg("mascot-loading")}
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function isLikelyUrl(text) {
  const t = text.trim();
  return /^https?:\/\//i.test(t) || /^[\w-]+\.(com|co\.kr|net|org|kr|go\.kr|or\.kr)/i.test(t);
}

function normalizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error("입력값이 비어 있습니다.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("http 또는 https 링크만 검사할 수 있습니다.");
  }
  return url.toString();
}

async function getInvokeErrorMessage(error, data) {
  if (data?.message) return data.message;

  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = await response.clone().json();
      if (body?.message) return body.message;
    } catch {
      // ignore
    }
  }

  return error?.message || "링크 분석 요청에 실패했습니다.";
}

function buildDemoVideoItems(query) {
  return [
    {
      status: "safe",
      title: `시니어 ${query} 건강 가이드`,
      reason: "공인된 건강 채널의 올바른 운동 정보입니다. 안심하고 시청하셔도 좋습니다.",
      thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuD0BYHgrHyMrv3GeC9ioNCysrGl5f92P24WQnsRMtyxqSbawBvtYufCUYqqsLmLKAV2uJ827eAzt1_Ahw6TfqVwuTDHPq0-4N4zjyIndIM55phyPsuWcHHNwum8PUqIRx1Tnja7ltIH2hLr_-QLBBRDHpdgI4pLjpCrX1cjQ_34ixwxKNnK1uTrYec6BG2tCR5khr032V2dn8PUD_7ONc3xz7BaBJ8iGvy_bIavzANlPJNkPaHkYWfR6a2BDrNWysGIBGeUfd3SwW7c",
    },
    {
      status: "warning",
      title: "하루 천만원 버는 비밀",
      reason: "과장된 수익 인증이 포함되어 있으니 주의하세요. 섣불리 개인정보를 입력하거나 결제하지 마십시오.",
      thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDeV4T-1OFRop-LDqZNJsy5Upiu903Oo1tyeqTu6uQ_uSswxWa08IgT8IijiH1bcTywqn_PtwwyiYydAD0CRcas7LDWLQH9QCVKhyCzF0B3W_53kkyppSkRz7iz8dG4T9fZsPIiqeAW_Tsl-2wqRwqAXsYI9a1DWFsaDbu0CquSdW-FTQILUb06qY6PKNIOPR-ifGeQ0uZs4flIrSxC5wERXepvRLHxMc7WURQBjgqTWz7yO8jgDh6EeAJsqYzdjDl9gcfaCjt6jLR7",
    },
    {
      status: "danger",
      title: "모든 암 즉시 완치 비법",
      reason: "과학적 근거가 없는 위험한 가짜 의료 정보입니다. 절대 따라하지 마시고, 제품을 구매하지 마세요.",
      thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuBbbihYNFpxGneFCRsyV1Ht_9zvzdVoLwRPJsOMV7l45FmxxFUBSRc3yOBw2hZldKxUkv32Wf3AN8-y1WraL0pq81e63ZrCwbwtdHknxcRX7ycB5lQUIEeJUvMrGKj0sFL-wtVy3TG_dFdKU3dj9RnIYhdizoYBUS2stpzmhpQV2JRglo2oaAW9SPMW4kKNn_ylqU6nSP0oS_Q6C1GgK62vxwhCAq3VWcjefJI_mHa_H5EKILGlFHsdJ6a-Kd25K2mDmLKLmE5_L1zw",
    },
  ];
}

function getYoutubeThumbnail(url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : "";
}

function getFaviconThumbnail(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=256`;
  } catch {
    return "";
  }
}

function resolveLinkThumbnail(url, scrapedThumbnail) {
  return scrapedThumbnail || getYoutubeThumbnail(url) || getFaviconThumbnail(url) || "";
}

function linkAnalysisToItem(data, url) {
  const isDanger = data.status === "위험";
  const thumbnail = resolveLinkThumbnail(url, data.scraped?.thumbnail);
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // keep full url
  }

  return {
    status: isDanger ? "danger" : "safe",
    title: data.scraped?.title || hostname,
    reason: data.reason || "분석 근거를 확인하지 못했습니다.",
    thumbnail,
    url,
    subtitle: url,
    isLink: true,
    domain: hostname,
  };
}

async function analyzeLink(url) {
  const { data, error } = await supabaseClient.functions.invoke("analyze-link", { body: { url } });
  if (error) {
    throw new Error(await getInvokeErrorMessage(error, data));
  }
  if (!data?.status) {
    throw new Error(data?.message || "분석 결과를 받지 못했습니다.");
  }
  return data;
}

async function searchVideos(query, limit = 5) {
  const { data, error } = await supabaseClient.functions.invoke("search-videos", {
    body: { query, limit },
  });
  if (error) {
    throw new Error(await getInvokeErrorMessage(error, data));
  }
  if (!Array.isArray(data?.videos)) {
    throw new Error(data?.message || "영상 검색 결과를 받지 못했습니다.");
  }
  return data.videos;
}

function isVideoSafe(video) {
  return video.status !== "위험";
}

function videoResultToItem(video) {
  const isDanger = !isVideoSafe(video);
  return {
    status: isDanger ? "danger" : "safe",
    title: video.title,
    reason: video.reason || "분석 결과 없음",
    thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${video.video_id}`,
    subtitle: `${video.channel || "YouTube"} · 영상`,
    videoId: video.video_id,
    channel: video.channel || "YouTube",
  };
}

const YOUTUBE_CATEGORIES = [
  { id: "music", label: "음악", query: "트로트 명곡 어르신" },
  { id: "affairs", label: "시사", query: "시사 뉴스 브리핑" },
  { id: "entertainment", label: "예능", query: "예능 프로 그리고" },
  { id: "documentary", label: "다큐", query: "다큐멘터리 역사" },
  { id: "health", label: "건강", query: "시니어 건강 운동" },
];

const NEWS_CATEGORIES = [
  { id: "affairs", label: "시사", query: "국정 시사" },
  { id: "society", label: "사회", query: "사회 뉴스" },
  { id: "health", label: "건강", query: "어르신 건강" },
  { id: "welfare", label: "복지", query: "기초연금 노인 복지" },
  { id: "life", label: "생활", query: "생활 정보" },
];

const WELFARE_CATEGORIES = [
  { id: "all", label: "전체", query: "all" },
  { id: "senior65", label: "65세+", query: "senior65" },
  { id: "middle", label: "50·60대", query: "middle" },
  { id: "care", label: "돌봄·요양", query: "care" },
  { id: "pension", label: "연금·수당", query: "pension" },
  { id: "health", label: "건강·의료", query: "health" },
  { id: "housing", label: "주거·생활", query: "housing" },
];

const WELFARE_CATEGORY_KEYWORDS = {
  senior65: ["65세", "노인", "어르신", "고령", "경로", "기초연금", "노년", "실버"],
  middle: ["50대", "60대", "중장년", "장년", "퇴직", "노후"],
  care: ["돌봄", "요양", "장기요양", "재가", "치매", "보호", "독거", "케어", "간병"],
  pension: ["연금", "수당", "급여", "기초생활", "생계", "소득", "지원금"],
  health: ["건강", "의료", "검진", "치료", "재활", "병원", "약"],
  housing: ["주거", "주택", "생활", "임대", "수리", "난방", "에너지"],
};

const HOME_YOUTUBE_PREVIEW = 3;
const HOME_NEWS_PREVIEW = 3;
const HOME_WELFARE_PREVIEW = 3;
const BROWSE_YOUTUBE_LIMIT = 20;
const BROWSE_NEWS_LIMIT = 20;
const BROWSE_WELFARE_LIMIT = 10;

function buildBrowsePageUrl(page, categoryId) {
  const params = new URLSearchParams();
  if (categoryId) params.set("category", categoryId);
  const query = params.toString();
  return `${page}.html${query ? `?${query}` : ""}`;
}

function findCategoryById(categories, categoryId) {
  return categories.find((cat) => cat.id === categoryId) || categories[0];
}

function getCategoryQuery(categories, categoryId) {
  return findCategoryById(categories, categoryId).query;
}

let cachedWelfareContext = null;
let welfareCategoryReload = null;

function bindWelfareCategoryReload(reloadFn) {
  welfareCategoryReload = reloadFn;
  if (cachedWelfareContext) reloadFn();
}

function filterWelfareServices(services, categoryId) {
  if (!Array.isArray(services) || categoryId === "all") return services;

  const keywords = WELFARE_CATEGORY_KEYWORDS[categoryId];
  if (!keywords?.length) return services;

  return services.filter((service) => {
    const haystack = [
      service.servNm,
      service.summary,
      service.target,
      service.benefit,
      service.criteria,
      service.department,
    ].filter(Boolean).join(" ");
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function setupCategoryTabs(tabsContainer, categories, contentContainer, loadFn, options = {}) {
  let activeId = categories[0].id;
  let loading = false;

  function notifyCategoryChange() {
    if (typeof options.onCategoryChange === "function") {
      options.onCategoryChange(activeId);
    }
  }

  function renderTabs() {
    tabsContainer.innerHTML = categories.map((cat) => `
      <button
        type="button"
        class="category-tab${cat.id === activeId ? " category-tab-active" : ""}"
        data-category="${cat.id}"
        role="tab"
        aria-selected="${cat.id === activeId}"
      >${escapeHtml(cat.label)}</button>
    `).join("");

    tabsContainer.querySelectorAll(".category-tab").forEach((button) => {
      button.addEventListener("click", async () => {
        const nextId = button.dataset.category;
        if (loading || nextId === activeId) return;

        activeId = nextId;
        renderTabs();
        await loadCategory();
      });
    });
  }

  async function loadCategory() {
    const category = categories.find((cat) => cat.id === activeId);
    if (!category) return;

    loading = true;
    tabsContainer.querySelectorAll(".category-tab").forEach((button) => {
      button.disabled = true;
    });

    try {
      await loadFn(contentContainer, category.query, { preview: options.preview !== false });
      notifyCategoryChange();
    } finally {
      loading = false;
      renderTabs();
    }
  }

  renderTabs();
  loadCategory();

  return { reload: loadCategory, getActiveId: () => activeId };
}

function renderVerifiedBadge(label) {
  return `
    <div class="verified-badge">
      <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
      ${escapeHtml(label)}
    </div>
  `;
}

function renderYoutubeThumbnailCard(item) {
  if (item.status === "danger") {
    return `
      <article class="browse-yt-card browse-yt-card-blocked" title="${escapeHtml(item.title)}">
        <div class="browse-yt-thumb browse-yt-thumb-blocked">
          <span class="material-symbols-outlined" aria-hidden="true">block</span>
          <span>차단됨</span>
        </div>
        <p class="browse-yt-label">${escapeHtml(item.title)}</p>
      </article>
    `;
  }

  return `
    <a class="browse-yt-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(item.title)}">
      <article class="browse-yt-card">
        <div class="browse-yt-thumb">
          <img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy" />
          ${renderVerifiedBadge("확인된 영상")}
        </div>
        <p class="browse-yt-label">${escapeHtml(item.title)}</p>
      </article>
    </a>
  `;
}

function renderYoutubeHomeCard(item) {
  return `
    <a class="video-card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
      <article class="video-card-ui">
        <div class="video-thumb">
          <img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy" />
          ${renderVerifiedBadge("확인된 영상")}
        </div>
        <div class="card-body">
          <h4 class="card-title">${escapeHtml(item.title)}</h4>
          <p class="card-meta">${escapeHtml(item.channel)}</p>
        </div>
      </article>
    </a>
  `;
}

async function fetchSafeYoutubeItems(query, neededCount) {
  const seenIds = new Set();
  const safeItems = [];
  const queryVariants = [
    query,
    `${query} 공식`,
    `${query} 추천`,
  ];

  for (const searchQuery of queryVariants) {
    if (safeItems.length >= neededCount) break;

    const videos = await searchVideos(searchQuery, 15);
    for (const video of videos) {
      if (!isVideoSafe(video)) continue;

      const item = videoResultToItem(video);
      if (seenIds.has(item.videoId)) continue;

      seenIds.add(item.videoId);
      safeItems.push(item);
      if (safeItems.length >= neededCount) break;
    }
  }

  return safeItems.slice(0, neededCount);
}

async function loadHomeYoutubeRecommendations(container, query, options = {}) {
  const preview = options.preview !== false;
  container.innerHTML = mascotLoadingHtml("어르신을 위한 안전한 영상을 찾고 있습니다...");

  try {
    if (preview) {
      const safeItems = await fetchSafeYoutubeItems(query, HOME_YOUTUBE_PREVIEW);

      if (safeItems.length === 0) {
        container.innerHTML = mascotLoadingHtml("안전한 추천 영상을 찾지 못했습니다. 잠시 후 새로고침해 주세요.");
        return;
      }

      container.innerHTML = safeItems.map(renderYoutubeHomeCard).join("");
      return;
    }

    const videos = await searchVideos(query, BROWSE_YOUTUBE_LIMIT);
    const items = videos.map(videoResultToItem);

    if (items.length === 0) {
      container.innerHTML = mascotLoadingHtml("추천 영상을 찾지 못했습니다. 잠시 후 새로고침해 주세요.");
      return;
    }

    container.innerHTML = `<div class="browse-grid browse-youtube-grid">${items.map(renderYoutubeThumbnailCard).join("")}</div>`;
  } catch {
    container.innerHTML = mascotLoadingHtml("영상을 불러오지 못했습니다. 검색창에서 직접 검색해 보세요.");
  }
}

async function searchNews(query, display = 5) {
  const { data, error } = await supabaseClient.functions.invoke("search-news", {
    body: { query, display },
  });
  if (error) {
    throw new Error(await getInvokeErrorMessage(error, data));
  }
  if (!Array.isArray(data?.articles)) {
    throw new Error(data?.message || "뉴스 검색 결과를 받지 못했습니다.");
  }
  return data.articles;
}

function renderNewsHomeCard(article) {
  const href = article.originallink || article.link;
  const thumb = article.thumbnail || getFaviconThumbnail(href);
  const isLogo = !article.thumbnail || thumb.includes("google.com/s2/favicons");
  const thumbClass = isLogo ? "news-thumb news-thumb-logo" : "news-thumb";
  const thumbHtml = thumb
    ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
    : `<span class="material-symbols-outlined" aria-hidden="true">newspaper</span>`;

  return `
    <a class="news-card-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
      <article class="news-card-ui">
        <div class="${thumbClass}">
          ${thumbHtml}
          ${renderVerifiedBadge("확인된 기사")}
        </div>
        <div class="news-body">
          <h4 class="news-title">${escapeHtml(article.title)}</h4>
          <p class="news-summary">${escapeHtml(article.summary)}</p>
          <span class="news-link">${escapeHtml(article.pubDate || "자세히 읽기")} →</span>
        </div>
      </article>
    </a>
  `;
}

async function loadHomeNewsRecommendations(container, query, options = {}) {
  const preview = options.preview !== false;
  container.innerHTML = mascotLoadingHtml("오늘의 뉴스를 불러오고 있습니다...");

  try {
    const articles = await searchNews(query, preview ? 5 : BROWSE_NEWS_LIMIT);
    const visibleArticles = preview ? articles.slice(0, HOME_NEWS_PREVIEW) : articles;

    if (visibleArticles.length === 0) {
      container.innerHTML = mascotLoadingHtml("뉴스를 찾지 못했습니다. 잠시 후 새로고침해 주세요.");
      return;
    }

    if (preview) {
      container.innerHTML = visibleArticles.map(renderNewsHomeCard).join("");
    } else {
      container.innerHTML = `<div class="browse-grid browse-news-grid">${visibleArticles.map(renderNewsHomeCard).join("")}</div>`;
    }
  } catch {
    container.innerHTML = mascotLoadingHtml("뉴스를 불러오지 못했습니다. Supabase에 search-news 배포 및 네이버 API 키를 확인해 주세요.");
  }
}

const DEFAULT_LOCATION = {
  latitude: 37.5665,
  longitude: 126.9780,
  label: "서울",
};

let cachedUserLocation = null;

function requestUserLocation(forcePrompt = false) {
  return new Promise((resolve) => {
    if (!forcePrompt && cachedUserLocation) {
      resolve(cachedUserLocation);
      return;
    }

    if (!navigator.geolocation) {
      cachedUserLocation = { ...DEFAULT_LOCATION, source: "default" };
      resolve(cachedUserLocation);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedUserLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          source: "gps",
        };
        resolve(cachedUserLocation);
      },
      () => {
        cachedUserLocation = { ...DEFAULT_LOCATION, source: "default" };
        resolve(cachedUserLocation);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  });
}

function weatherCodeToLabel(code) {
  if (code === 0) return "맑음";
  if (code <= 3) return "구름 조금";
  if (code <= 48) return "안개";
  if (code <= 57) return "이슬비";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈";
  if (code <= 99) return "뇌우";
  return "알 수 없음";
}

function parseKoreanLocationFromGeo(geo) {
  const admin = geo?.localityInfo?.administrative;
  let region = geo?.principalSubdivision || geo?.countryName || "대한민국";
  let city = geo?.city || geo?.locality || region;

  if (Array.isArray(admin)) {
    const findAdmin = (level) => admin.find((item) => item.adminLevel === level)?.name;
    const province = findAdmin(4) || findAdmin(3);
    const district = findAdmin(6) || findAdmin(8) || findAdmin(5);
    if (province) region = province;
    if (district) city = district;
  }

  region = normalizeKoreanRegionName(region);
  city = normalizeKoreanCityName(city, region);

  const label = city && city !== region
    ? (geo?.locality && geo.locality !== city ? `${city} ${geo.locality}` : city)
    : region;

  return { region, city, label };
}

const ENGLISH_TO_KOREAN_REGION = {
  gyeonggi: "경기도",
  seoul: "서울특별시",
  busan: "부산광역시",
  daegu: "대구광역시",
  incheon: "인천광역시",
  gwangju: "광주광역시",
  daejeon: "대전광역시",
  ulsan: "울산광역시",
  sejong: "세종특별자치시",
  gangwon: "강원특별자치도",
  chungbuk: "충청북도",
  chungnam: "충청남도",
  jeonbuk: "전북특별자치도",
  jeonnam: "전라남도",
  gyeongbuk: "경상북도",
  gyeongnam: "경상남도",
  jeju: "제주특별자치도",
};

const ENGLISH_TO_KOREAN_CITY = {
  suwon: "수원",
  seongnam: "성남",
  yongin: "용인",
  goyang: "고양",
  bucheon: "부천",
  anyang: "안양",
  namyangju: "남양주",
  hwaseong: "화성",
  pyeongtaek: "평택",
  siheung: "시흥",
  uijeongbu: "의정부",
  ansan: "안산",
  gimpo: "김포",
  paju: "파주",
};

function normalizeKoreanRegionName(name) {
  const raw = String(name ?? "").trim();
  const lower = raw.toLowerCase().replace(/[\s_-]+/g, "");
  for (const [english, korean] of Object.entries(ENGLISH_TO_KOREAN_REGION)) {
    if (lower.includes(english)) return korean;
  }
  return raw;
}

function normalizeKoreanCityName(city, region) {
  let value = String(city ?? "").trim();
  const lower = value.toLowerCase().replace(/[^a-z0-9\uAC00-\uD7A3]/g, "");
  for (const [english, korean] of Object.entries(ENGLISH_TO_KOREAN_CITY)) {
    if (lower.includes(english)) return korean;
  }

  if (String(region).includes("경기")) {
    const guMap = { 분당: "성남", 수정: "성남", 중원: "성남", 기흥: "용인", 수지: "용인", 처인: "용인" };
    for (const [gu, parent] of Object.entries(guMap)) {
      if (value.includes(gu)) return parent;
    }
  }

  const siMatch = value.match(/([\uAC00-\uD7A3]{2,})(?:시|군)/u);
  if (siMatch?.[1]) return siMatch[1];

  return value;
}

function normalizeWelfareAreaName(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/(특별자치시|특별자치도|광역시|특별시|자치시|자치도|시|도|구|군)$/u, "")
    .toLowerCase();
}

function filterLocalWelfareByRegion(services, apiData) {
  if (!Array.isArray(services) || !apiData?.region) return [];

  const targetRegion = normalizeWelfareAreaName(apiData.region);
  return services.filter((service) => {
    if (service.source === "national") return false;
    if (!service.region?.trim()) return false;
    const serviceRegion = normalizeWelfareAreaName(service.region);
    return (
      serviceRegion.includes(targetRegion.slice(0, 2)) ||
      targetRegion.includes(serviceRegion.slice(0, 2))
    );
  });
}

function formatWelfareLocationLabel(apiData, fallbackLabel, locationSource) {
  const resolved = [apiData?.region, apiData?.city].filter(Boolean).join(" ");
  const suffix = locationSource === "default" ? " (기본 위치 · 서울)" : "";
  if (resolved) {
    return `📍 ${resolved}${suffix} · 지역 맞춤 복지`;
  }
  return `📍 ${fallbackLabel}${suffix} · 지역 맞춤 복지`;
}

async function fetchLocationLabelDirect(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "ko",
  });

  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("위치 정보를 받지 못했습니다.");
  }

  const geo = await response.json();
  return parseKoreanLocationFromGeo(geo);
}

async function fetchWeatherDirect(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code",
    timezone: "Asia/Seoul",
  });

  const [location, weatherResponse] = await Promise.all([
    fetchLocationLabelDirect(latitude, longitude),
    fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`),
  ]);

  if (!weatherResponse.ok) {
    throw new Error("날씨 정보를 받지 못했습니다.");
  }

  const data = await weatherResponse.json();
  const current = data?.current;

  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("날씨 정보를 받지 못했습니다.");
  }

  const weatherCode = typeof current.weather_code === "number" ? current.weather_code : 0;

  return {
    ...location,
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
    weatherCode,
    condition: weatherCodeToLabel(weatherCode),
    latitude,
    longitude,
  };
}

async function fetchWeather(latitude, longitude) {
  try {
    const { data, error } = await supabaseClient.functions.invoke("get-weather", {
      body: { latitude, longitude },
    });

    if (!error && typeof data?.temperature === "number") {
      return data;
    }
  } catch {
    // Edge Function 미배포·오류 시 브라우저에서 직접 조회
  }

  return fetchWeatherDirect(latitude, longitude);
}

async function fetchWelfareInfo(region, city, category = "all", limit = 4, coords = null) {
  const body = { region, city, category, limit };
  if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
    body.latitude = coords.latitude;
    body.longitude = coords.longitude;
  }

  const { data, error } = await supabaseClient.functions.invoke("search-welfare", { body });

  if (error) {
    throw new Error(await getInvokeErrorMessage(error, data));
  }

  if (!Array.isArray(data?.services) || !Array.isArray(data?.nationalServices)) {
    throw new Error(data?.message || "복지 정보를 받지 못했습니다.");
  }

  return data;
}

function renderWelfareServiceCard(service, compact = false) {
  const isNational = service.source === "national";
  const badge = isNational ? "중앙부처 복지" : "지자체 복지";
  const regionLabel = [service.region, service.city].filter(Boolean).join(" ");
  const metaParts = isNational
    ? [service.department, service.organization].filter(Boolean)
    : [regionLabel, service.department].filter(Boolean);
  const summaryText = service.summary || "";

  if (compact) {
    return `
      <article class="welfare-card welfare-card-compact">
        <div class="welfare-badge">${badge}</div>
        <h4 class="welfare-title">${escapeHtml(service.servNm)}</h4>
        ${metaParts.length ? `<p class="welfare-meta">${escapeHtml(metaParts.join(" · "))}</p>` : ""}
        ${summaryText ? `<p class="welfare-address">${escapeHtml(summaryText)}</p>` : ""}
        ${service.onlineAvailable === "Y" ? `<span class="welfare-online">온라인 신청 가능</span>` : ""}
        <a class="welfare-link" href="${escapeHtml(service.link)}" target="_blank" rel="noopener noreferrer">자세히 보기 →</a>
      </article>
    `;
  }

  const target = service.target ? `<p class="welfare-detail"><strong>지원대상</strong> ${escapeHtml(service.target)}</p>` : "";
  const criteria = service.criteria ? `<p class="welfare-detail"><strong>선정기준</strong> ${escapeHtml(service.criteria)}</p>` : "";
  const benefit = service.benefit ? `<p class="welfare-detail"><strong>지원내용</strong> ${escapeHtml(service.benefit)}</p>` : "";
  const application = service.applicationMethod ? `<p class="welfare-detail"><strong>신청방법</strong> ${escapeHtml(service.applicationMethod)}</p>` : "";
  const inquiry = service.inquiry ? `<p class="welfare-meta">☎ ${escapeHtml(service.inquiry)}</p>` : "";
  const updated = service.updatedAt ? `<p class="welfare-meta">최종 수정 ${escapeHtml(service.updatedAt)}</p>` : "";
  const online = service.onlineAvailable === "Y"
    ? `<span class="welfare-online">온라인 신청 가능</span>`
    : "";

  return `
    <article class="welfare-card">
      <div class="welfare-badge">${badge}</div>
      <h4 class="welfare-title">${escapeHtml(service.servNm)}</h4>
      ${metaParts.length ? `<p class="welfare-meta">${escapeHtml(metaParts.join(" · "))}</p>` : ""}
      ${summaryText ? `<p class="welfare-address">${escapeHtml(summaryText)}</p>` : ""}
      ${target}
      ${criteria}
      ${benefit}
      ${application}
      ${inquiry}
      ${updated}
      ${online}
      <a class="welfare-link" href="${escapeHtml(service.link)}" target="_blank" rel="noopener noreferrer">복지로에서 자세히 보기 →</a>
    </article>
  `;
}

function weatherCodeToIcon(code) {
  if (code === 0) return "sunny";
  if (code <= 3) return "partly_cloudy_day";
  if (code <= 48) return "foggy";
  if (code <= 67) return "rainy";
  if (code <= 77) return "ac_unit";
  if (code <= 82) return "rainy";
  if (code <= 86) return "ac_unit";
  if (code <= 99) return "thunderstorm";
  return "partly_cloudy_day";
}

function renderWeatherWidget(weather, locationSource) {
  const mainEl = document.getElementById("weather-main");
  const subEl = document.getElementById("weather-sub");
  const tempEl = document.getElementById("weather-temp");
  const iconEl = document.getElementById("weather-icon");
  const locationButton = document.getElementById("location-button");

  if (!mainEl || !subEl || !iconEl) return;

  if (tempEl) tempEl.textContent = `${weather.temperature}°`;
  mainEl.textContent = weather.label;
  const locationNote = locationSource === "default" ? " · 기본(서울)" : "";
  subEl.textContent = `${weather.condition} · 체감 ${weather.apparentTemperature}°C${locationNote}`;
  iconEl.textContent = weatherCodeToIcon(weather.weatherCode);

  if (locationButton) {
    locationButton.classList.toggle("hidden", locationSource === "gps");
  }
}

function renderWelfareQuickLinks(links) {
  if (!Array.isArray(links) || links.length === 0) return "";

  return `
    <div class="welfare-quick-links">
      <h4 class="welfare-subheading">공식 복지 안내</h4>
      ${links.map((item) => `
        <a class="welfare-quick-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.description)}</span>
        </a>
      `).join("")}
    </div>
  `;
}

async function loadHomeWelfareInfo(container, categoryId = "all", options = {}) {
  const preview = options.preview !== false;
  const locationLabel = document.getElementById("welfare-location-label");

  if (!cachedWelfareContext) {
    container.innerHTML = mascotLoadingHtml("위치 정보를 확인한 뒤 복지 정보를 불러옵니다...");
    return;
  }

  const { weather, locationSource, coords } = cachedWelfareContext;

  if (locationLabel) {
    locationLabel.textContent = formatWelfareLocationLabel(null, weather.label, locationSource);
  }

  container.innerHTML = mascotLoadingHtml("우리 지역 복지 혜택을 찾고 있습니다...");

  try {
    const fetchLimit = preview ? 6 : BROWSE_WELFARE_LIMIT;
    const data = await fetchWelfareInfo(weather.region, weather.city, categoryId, fetchLimit, coords);

    if (locationLabel) {
      locationLabel.textContent = formatWelfareLocationLabel(data, weather.label, locationSource);
    }

    let localServices = filterLocalWelfareByRegion(
      filterWelfareServices(data.services, categoryId),
      data,
    );
    let nationalServices = filterWelfareServices(data.nationalServices, categoryId);

    if (preview) {
      localServices = localServices.slice(0, HOME_WELFARE_PREVIEW);
    }

    const categoryLabel = WELFARE_CATEGORIES.find((cat) => cat.id === categoryId)?.label ?? "전체";

    const emptyLocal = mascotLoadingHtml(`${categoryLabel} · ${data.region || "해당"} 지역 복지를 찾지 못했습니다.`);
    const emptyNational = mascotLoadingHtml(`${categoryLabel} 분야 중앙부처 복지서비스를 찾지 못했습니다.`);

    if (preview) {
      if (localServices.length === 0) {
        container.innerHTML = emptyLocal;
        return;
      }

      container.innerHTML = `<div class="home-preview-list">${localServices.map((s) => renderWelfareServiceCard(s, true)).join("")}</div>`;
      return;
    }

    if (!preview) {
      nationalServices = nationalServices.slice(0, BROWSE_WELFARE_LIMIT);
    }

    const localHtml = localServices.length > 0
      ? `<div class="browse-grid browse-welfare-grid">${localServices.map((s) => renderWelfareServiceCard(s, true)).join("")}</div>`
      : emptyLocal;
    const nationalHtml = nationalServices.length > 0
      ? `<div class="browse-grid browse-welfare-grid">${nationalServices.map((s) => renderWelfareServiceCard(s, true)).join("")}</div>`
      : emptyNational;

    container.innerHTML = `
      <div class="welfare-services welfare-services-browse">
        <section class="welfare-block">
          <h4 class="welfare-subheading">우리 지역 · 지자체 복지</h4>
          <p class="welfare-source-note">${escapeHtml([data.region, data.city].filter(Boolean).join(" ") || categoryLabel)} · 지자체복지서비스 API</p>
          ${localHtml}
        </section>
        <section class="welfare-block">
          <h4 class="welfare-subheading">전국 · 중앙부처 복지</h4>
          <p class="welfare-source-note">${escapeHtml(categoryLabel)} · 복지서비스정보 API</p>
          ${nationalHtml}
        </section>
        ${renderWelfareQuickLinks(data.links)}
      </div>
    `;
  } catch {
    container.innerHTML = mascotLoadingHtml("복지 정보를 불러오지 못했습니다. Supabase에 search-welfare 배포 및 DATA_GO_KR_SERVICE_KEY를 확인해 주세요.");
  }
}

async function initBrowseWelfareLocation(forcePrompt = false) {
  const location = await requestUserLocation(forcePrompt);
  let weather = null;

  try {
    weather = await fetchWeather(location.latitude, location.longitude);
  } catch {
    weather = await fetchLocationLabelDirect(location.latitude, location.longitude);
  }

  cachedWelfareContext = { weather, locationSource: location.source, coords: location };

  const locationLabel = document.getElementById("browse-welfare-location");
  if (locationLabel) {
    const suffix = location.source === "default" ? " (기본 위치 · 서울)" : "";
    locationLabel.textContent = `📍 ${weather.label}${suffix}`;
  }

  return cachedWelfareContext;
}

async function initHomeLocationServices(forcePrompt = false) {
  const welfareContainer = document.getElementById("welfare-content");
  const mainEl = document.getElementById("weather-main");
  const subEl = document.getElementById("weather-sub");
  const tempEl = document.getElementById("weather-temp");
  const locationButton = document.getElementById("location-button");

  if (tempEl) tempEl.textContent = "--°";
  if (mainEl) mainEl.textContent = "날씨 확인 중...";
  if (subEl) subEl.textContent = "위치를 불러오고 있습니다";
  if (locationButton) locationButton.classList.add("hidden");

  const location = await requestUserLocation(forcePrompt);
  let weather = null;

  try {
    weather = await fetchWeather(location.latitude, location.longitude);
    renderWeatherWidget(weather, location.source);
  } catch {
    if (tempEl) tempEl.textContent = "--°";
    if (mainEl) mainEl.textContent = "날씨를 불러올 수 없음";
    if (subEl) subEl.textContent = "인터넷 연결을 확인해 주세요";
    locationButton?.classList.remove("hidden");
  }

  if (welfareContainer) {
    try {
      if (!weather) {
        weather = await fetchLocationLabelDirect(location.latitude, location.longitude);
      }
      cachedWelfareContext = { weather, locationSource: location.source, coords: location };
      if (welfareCategoryReload) {
        await welfareCategoryReload();
      } else {
        await loadHomeWelfareInfo(welfareContainer, "all");
      }
    } catch {
      welfareContainer.innerHTML = mascotLoadingHtml("복지 정보를 불러오지 못했습니다. search-welfare 함수와 DATA_GO_KR_SERVICE_KEY를 확인해 주세요.");
    }
  }
}

async function runSearch(raw) {
  const query = raw.trim();
  if (!query) {
    throw new Error("검색어 또는 링크를 입력해 주세요.");
  }

  if (isLikelyUrl(query)) {
    const url = normalizeUrl(query);
    const data = await analyzeLink(url);
    return {
      query,
      type: "link",
      summary: data.status === "위험"
        ? "⚠️ 입력하신 링크에서 위험 신호가 감지되었습니다."
        : "✅ 입력하신 링크는 비교적 안전해 보입니다.",
      items: [linkAnalysisToItem(data, url)],
    };
  }

  const videos = await searchVideos(query);
  if (videos.length === 0) {
    throw new Error("검색 결과가 없습니다. 다른 검색어를 입력해 주세요.");
  }

  const items = videos.map(videoResultToItem);
  const dangerCount = items.filter((item) => item.status === "danger").length;

  return {
    query,
    type: "youtube",
    summary: dangerCount > 0
      ? `총 ${items.length}개 영상 검사 · 위험 ${dangerCount}건 발견`
      : `총 ${items.length}개의 영상을 정밀 검사했습니다.`,
    items,
  };
}

function saveSearchResults(payload) {
  sessionStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(payload));
}

function loadSearchResults() {
  try {
    const raw = sessionStorage.getItem(SEARCH_RESULTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function goToResultsPage() {
  window.location.href = "results.html";
}

async function chatWithAgent(message, history) {
  const { data, error } = await supabaseClient.functions.invoke("chat-agent", {
    body: { message, history },
  });

  if (error) {
    throw new Error(await getInvokeErrorMessage(error, data));
  }

  if (!data?.reply) {
    throw new Error(data?.message || "챗봇 응답을 받지 못했습니다.");
  }

  return data;
}

function getSiteHeaderHtml() {
  return `
    <div class="site-header-row">
      <a class="site-brand" href="index.html">
        <img src="assets/mascot-sheriff.png" alt="" class="brand-mascot" width="48" height="48" />
        <span class="site-brand-text">시니어 디지털 보안관</span>
      </a>
      <nav class="top-nav" aria-label="주요 메뉴" data-auto-nav></nav>
      <div class="header-end">
        <div class="auth-area" id="auth-area">
          <span id="user-greeting" class="user-greeting hidden"></span>
          <button type="button" id="login-button" class="auth-button auth-login btn btn--primary">로그인</button>
          <button type="button" id="logout-button" class="auth-button auth-logout btn btn--secondary hidden">로그아웃</button>
        </div>
        <button type="button" id="mobile-menu-toggle" class="mobile-menu-toggle" aria-label="메뉴 열기" aria-expanded="false" aria-controls="mobile-nav">
          <span class="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
      </div>
    </div>
    <nav id="mobile-nav" class="mobile-nav hidden" aria-label="모바일 메뉴" data-auto-nav="true"></nav>
  `;
}

function injectSiteHeader() {
  const header = document.querySelector("header.site-header");
  if (!header) return;
  header.innerHTML = getSiteHeaderHtml();
}

function getLoginModalHtml() {
  return `
    <div id="login-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
      <div class="modal-panel card">
        <button type="button" id="login-modal-close" class="modal-close btn btn--danger" aria-label="로그인 창 닫기">닫기</button>
        <h2 id="login-modal-title" class="modal-title">로그인</h2>
        <p class="modal-desc">이메일과 비밀번호로 로그인하세요. (Supabase 계정)</p>
        <form id="login-form" class="login-form">
          <label for="login-email" class="form-label">이메일</label>
          <input id="login-email" type="email" class="modal-input" placeholder="example@email.com" autocomplete="email" required />
          <label for="login-password" class="form-label">비밀번호</label>
          <input id="login-password" type="password" class="modal-input" placeholder="비밀번호" autocomplete="current-password" required />
          <div id="login-error" class="login-error alert-persistent hidden" role="alert">
            <p id="login-error-message"></p>
            <button type="button" id="login-error-close" class="btn btn--danger">닫기</button>
          </div>
          <button type="submit" class="modal-submit btn btn--primary">로그인하기</button>
        </form>
        <p class="modal-note">계정이 없으시면 Supabase에서 회원가입 후 이용해 주세요.</p>
      </div>
    </div>
  `;
}

function injectLoginModal() {
  if (document.getElementById("login-modal")) return;
  document.body.insertAdjacentHTML("beforeend", getLoginModalHtml());
}

function getUserDisplayName(user) {
  if (!user) return "회원";
  const emailLocal = user.email?.split("@")[0] ?? "회원";
  return emailLocal.replace(/[^\w.\-가-힣]/g, "").slice(0, 32) || "회원";
}

const SiteAuth = {
  updateAuthUI(user) {
    const greeting = document.getElementById("user-greeting");
    const loginBtn = document.getElementById("login-button");
    const logoutBtn = document.getElementById("logout-button");

    if (user) {
      const safeName = getUserDisplayName(user);
      if (greeting) greeting.textContent = `${safeName}님`;
      greeting?.classList.remove("hidden");
      loginBtn?.classList.add("hidden");
      logoutBtn?.classList.remove("hidden");
    } else {
      greeting?.classList.add("hidden");
      loginBtn?.classList.remove("hidden");
      logoutBtn?.classList.add("hidden");
    }
  },

  hideLoginError() {
    document.getElementById("login-error")?.classList.add("hidden");
  },

  showLoginError(message) {
    const box = document.getElementById("login-error");
    const text = document.getElementById("login-error-message");
    if (text) text.textContent = message;
    box?.classList.remove("hidden");
  },

  openLoginModal() {
    SiteAuth.hideLoginError();
    document.getElementById("login-modal")?.classList.remove("hidden");
    document.getElementById("login-email")?.focus();
  },

  closeLoginModal() {
    document.getElementById("login-modal")?.classList.add("hidden");
    document.getElementById("login-form")?.reset();
    SiteAuth.hideLoginError();
  },

  async handleLoginSubmit(event) {
    event.preventDefault();
    SiteAuth.hideLoginError();

    try {
      const email = (document.getElementById("login-email")?.value ?? "").trim();
      const password = document.getElementById("login-password")?.value ?? "";

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("올바른 이메일 주소를 입력해 주세요.");
      }
      if (!password) throw new Error("비밀번호를 입력해 주세요.");

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        SiteAuth.showLoginError("로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
        return;
      }

      SiteAuth.closeLoginModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인 중 문제가 발생했습니다.";
      SiteAuth.showLoginError(message);
    }
  },

  async handleLogout() {
    await supabaseClient.auth.signOut();
  },

  bindEvents() {
    document.getElementById("login-button")?.addEventListener("click", () => SiteAuth.openLoginModal());
    document.getElementById("login-modal-close")?.addEventListener("click", () => SiteAuth.closeLoginModal());
    document.getElementById("login-form")?.addEventListener("submit", (e) => SiteAuth.handleLoginSubmit(e));
    document.getElementById("login-error-close")?.addEventListener("click", () => SiteAuth.hideLoginError());
    document.getElementById("logout-button")?.addEventListener("click", () => SiteAuth.handleLogout());
  },

  async init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    SiteAuth.updateAuthUI(session?.user ?? null);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      SiteAuth.updateAuthUI(session?.user ?? null);
    });
    SiteAuth.bindEvents();
  },
};

function getSiteFooterHtml() {
  return `
    <footer class="site-footer" aria-label="사이트 하단">
      <div class="site-footer-inner">
        <nav class="site-footer-nav" aria-label="정보 링크">
          <a href="terms.html">이용약관</a>
          <span class="footer-divider" aria-hidden="true">·</span>
          <a href="privacy.html">개인정보처리방침</a>
          <span class="footer-divider" aria-hidden="true">·</span>
          <a href="team.html">팀 소개</a>
        </nav>
        <div class="site-footer-bottom">
          <img src="${MASCOT_POTATO_SRC}" alt="" class="footer-potato" width="40" height="40" loading="lazy" />
          <p class="site-footer-copy">© 2026 샤이한 열정 감자들</p>
        </div>
      </div>
    </footer>
  `;
}

function injectSiteFooter() {
  const layout = document.querySelector(".app-layout");
  if (!layout || layout.querySelector(".site-footer")) return;
  layout.insertAdjacentHTML("beforeend", getSiteFooterHtml());
}

/**
 * 상단·모바일 네비 링크 HTML 생성
 * @param {string} activeId
 * @param {"top-nav-link"|"mobile-nav-link"} linkClass
 */
function buildNavLinksHtml(activeId, linkClass) {
  const isMobile = linkClass === "mobile-nav-link";
  const activeClass = isMobile ? " mobile-nav-active" : " nav-active";

  return SITE_NAV_ITEMS.map(({ id, href, label }) => {
    const active = id === activeId ? activeClass : "";
    return `<a class="${linkClass}${active}" href="${href}" data-nav="${id}">${label}</a>`;
  }).join("");
}

/** body[data-nav] 기준으로 네비 주입 */
function initSiteNavigation() {
  const activeId = document.body.dataset.nav || "";

  const topNav = document.querySelector(".top-nav[data-auto-nav]");
  if (topNav) {
    topNav.innerHTML = buildNavLinksHtml(activeId, "top-nav-link");
  }

  const mobileNav = document.getElementById("mobile-nav");
  if (mobileNav?.dataset.autoNav === "true") {
    mobileNav.innerHTML = buildNavLinksHtml(activeId, "mobile-nav-link");
  }

  document.querySelectorAll(".top-nav-link, .mobile-nav-link").forEach((link) => {
    link.addEventListener("click", () => closeMobileNavMenu());
  });

  const mobileToggle = document.getElementById("mobile-menu-toggle");
  mobileToggle?.addEventListener("click", () => {
    if (!mobileNav) return;
    const willOpen = mobileNav.classList.contains("hidden");
    mobileNav.classList.toggle("hidden", !willOpen);
    mobileToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
}

function closeMobileNavMenu() {
  const mobileNav = document.getElementById("mobile-nav");
  const toggle = document.getElementById("mobile-menu-toggle");
  mobileNav?.classList.add("hidden");
  toggle?.setAttribute("aria-expanded", "false");
}

document.addEventListener("DOMContentLoaded", () => {
  injectSiteHeader();
  injectLoginModal();
  initSiteNavigation();
  SiteAuth.init();
  injectSiteFooter();
});
