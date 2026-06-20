/**
 * 시니어 디지털 보안관 - 공통 유틸 / 검색 로직
 */

const SUPABASE_URL = "https://oweduuhfkiutlszfwukt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZWR1dWhma2l1dGxzemZ3dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjMyNzUsImV4cCI6MjA5NzUzOTI3NX0.n25pwv-WuWOBIGY7cwJCYj1TxILYpy2XA2nn7a6ySMY";
const SEARCH_RESULTS_KEY = "sheriff-search-results";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function searchVideos(query) {
  const { data, error } = await supabaseClient.functions.invoke("search-videos", { body: { query } });
  if (error) {
    throw new Error(await getInvokeErrorMessage(error, data));
  }
  if (!Array.isArray(data?.videos)) {
    throw new Error(data?.message || "영상 검색 결과를 받지 못했습니다.");
  }
  return data.videos;
}

function videoResultToItem(video) {
  const isDanger = video.status === "위험";
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

function setupCategoryTabs(tabsContainer, categories, contentContainer, loadFn) {
  let activeId = categories[0].id;
  let loading = false;

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
      await loadFn(contentContainer, category.query);
    } finally {
      loading = false;
      renderTabs();
    }
  }

  renderTabs();
  loadCategory();
}

function renderYoutubeHomeCard(item) {
  if (item.status === "danger") {
    return `
      <article class="blocked-card-ui">
        <p class="card-title" style="color:#dc2626">🚨 보안관 차단: 검증되지 않은 영상</p>
        <p class="card-meta" style="color:#7f1d1d;margin-bottom:0.35rem">${escapeHtml(item.title)}</p>
        <p class="card-meta" style="color:#7f1d1d">${escapeHtml(item.reason)}</p>
      </article>
    `;
  }

  return `
    <a class="video-card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
      <article class="video-card-ui">
        <div class="video-thumb">
          <img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy" />
          <div class="safe-badge-ui">
            <span class="material-symbols-outlined" style="font-size:16px">check_circle</span> 안전 확인됨
          </div>
        </div>
        <div class="card-body">
          <h4 class="card-title">${escapeHtml(item.title)}</h4>
          <p class="card-meta">${escapeHtml(item.channel)}</p>
        </div>
      </article>
    </a>
  `;
}

async function loadHomeYoutubeRecommendations(container, query) {
  container.innerHTML = `<p class="youtube-loading">어르신을 위한 안전한 영상을 찾고 있습니다...</p>`;

  try {
    const videos = await searchVideos(query);
    const items = videos.map(videoResultToItem);

    if (items.length === 0) {
      container.innerHTML = `<p class="youtube-loading">추천 영상을 찾지 못했습니다. 잠시 후 새로고침해 주세요.</p>`;
      return;
    }

    container.innerHTML = items.map(renderYoutubeHomeCard).join("");
  } catch {
    container.innerHTML = `<p class="youtube-loading">영상을 불러오지 못했습니다. 검색창에서 직접 검색해 보세요.</p>`;
  }
}

async function searchNews(query) {
  const { data, error } = await supabaseClient.functions.invoke("search-news", { body: { query } });
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
  const publisher = article.publisher || "뉴스";
  const isLogo = !article.thumbnail || thumb.includes("google.com/s2/favicons");
  const thumbClass = isLogo ? "news-thumb news-thumb-logo" : "news-thumb";
  const thumbHtml = thumb
    ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
    : `<span class="material-symbols-outlined" aria-hidden="true">newspaper</span>`;

  return `
    <a class="news-card-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
      <article class="news-card-ui">
        <div class="${thumbClass}">${thumbHtml}</div>
        <div class="news-body">
          <div class="news-badge">
            <span class="material-symbols-outlined" style="font-size:20px">verified</span>
            ${escapeHtml(publisher)}
          </div>
          <h4 class="news-title">${escapeHtml(article.title)}</h4>
          <p class="news-summary">${escapeHtml(article.summary)}</p>
          <span class="news-link">${escapeHtml(article.pubDate || "자세히 읽기")} →</span>
        </div>
      </article>
    </a>
  `;
}

async function loadHomeNewsRecommendations(container, query) {
  container.innerHTML = `<p class="youtube-loading">오늘의 뉴스를 불러오고 있습니다...</p>`;

  try {
    const articles = await searchNews(query);

    if (articles.length === 0) {
      container.innerHTML = `<p class="youtube-loading">뉴스를 찾지 못했습니다. 잠시 후 새로고침해 주세요.</p>`;
      return;
    }

    container.innerHTML = articles.slice(0, 5).map(renderNewsHomeCard).join("");
  } catch {
    container.innerHTML = `<p class="youtube-loading">뉴스를 불러오지 못했습니다. Supabase에 search-news 배포 및 네이버 API 키를 확인해 주세요.</p>`;
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
  const region = geo.principalSubdivision || geo.countryName || "대한민국";
  const city = geo.city || geo.locality || region;
  const label = geo.locality && geo.locality !== city
    ? `${city} ${geo.locality}`
    : city;

  return { region, city, label };
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

async function fetchWelfareInfo(region, city) {
  const { data, error } = await supabaseClient.functions.invoke("search-welfare", {
    body: { region, city },
  });

  if (error) {
    throw new Error(await getInvokeErrorMessage(error, data));
  }

  if (!Array.isArray(data?.services) || !Array.isArray(data?.nationalServices)) {
    throw new Error(data?.message || "복지 정보를 받지 못했습니다.");
  }

  return data;
}

function renderWelfareServiceCard(service) {
  const isNational = service.source === "national";
  const badge = isNational ? "중앙부처 복지" : "지자체 복지";
  const regionLabel = [service.region, service.city].filter(Boolean).join(" ");
  const metaParts = isNational
    ? [service.department, service.organization].filter(Boolean)
    : [regionLabel, service.department].filter(Boolean);
  const target = service.target ? `<p class="welfare-detail"><strong>지원대상</strong> ${escapeHtml(service.target)}</p>` : "";
  const criteria = service.criteria ? `<p class="welfare-detail"><strong>선정기준</strong> ${escapeHtml(service.criteria)}</p>` : "";
  const benefit = service.benefit ? `<p class="welfare-detail"><strong>지원내용</strong> ${escapeHtml(service.benefit)}</p>` : "";
  const application = service.applicationMethod ? `<p class="welfare-detail"><strong>신청방법</strong> ${escapeHtml(service.applicationMethod)}</p>` : "";
  const inquiry = service.inquiry ? `<p class="welfare-meta">☎ ${escapeHtml(service.inquiry)}</p>` : "";
  const updated = service.updatedAt ? `<p class="welfare-meta">최종 수정 ${escapeHtml(service.updatedAt)}</p>` : "";
  const online = service.onlineAvailable === "Y"
    ? `<span class="welfare-online">온라인 신청 가능</span>`
    : "";
  const summaryText = service.summary || "";

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
  const iconEl = document.getElementById("weather-icon");
  const locationButton = document.getElementById("location-button");

  if (!mainEl || !subEl || !iconEl) return;

  mainEl.textContent = `${weather.label} ${weather.temperature}°C`;
  const locationNote = locationSource === "default" ? " · 기본 위치(서울)" : " · 내 위치";
  subEl.textContent = `📍 ${weather.condition} · 체감 ${weather.apparentTemperature}°C${locationNote}`;
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

async function loadHomeWelfareInfo(container, weather, locationSource) {
  const locationLabel = document.getElementById("welfare-location-label");
  const suffix = locationSource === "default" ? " (기본 위치 · 서울)" : "";

  if (locationLabel) {
    locationLabel.textContent = `📍 ${weather.label}${suffix} 맞춤 복지 정보`;
  }

  container.innerHTML = `<p class="youtube-loading">우리 지역 복지 혜택을 찾고 있습니다...</p>`;

  try {
    const data = await fetchWelfareInfo(weather.region, weather.city);
    const localHtml = data.services.length > 0
      ? data.services.map(renderWelfareServiceCard).join("")
      : `<p class="youtube-loading">해당 지역 지자체 복지서비스를 찾지 못했습니다.</p>`;
    const nationalHtml = data.nationalServices.length > 0
      ? data.nationalServices.map(renderWelfareServiceCard).join("")
      : `<p class="youtube-loading">중앙부처 복지서비스를 찾지 못했습니다.</p>`;

    container.innerHTML = `
      <div class="welfare-services">
        <section class="welfare-block">
          <h4 class="welfare-subheading">우리 지역 · 지자체 복지</h4>
          <p class="welfare-source-note">지자체복지서비스 API · 노년·보호·돌봄 분야</p>
          ${localHtml}
        </section>
        <section class="welfare-block">
          <h4 class="welfare-subheading">전국 · 중앙부처 복지</h4>
          <p class="welfare-source-note">복지서비스정보 API · 어르신 관련 혜택</p>
          ${nationalHtml}
        </section>
        ${renderWelfareQuickLinks(data.links)}
      </div>
    `;
  } catch {
    container.innerHTML = `<p class="youtube-loading">복지 정보를 불러오지 못했습니다. Supabase에 search-welfare 배포 및 DATA_GO_KR_SERVICE_KEY를 확인해 주세요.</p>`;
  }
}

async function initHomeLocationServices(forcePrompt = false) {
  const welfareContainer = document.getElementById("welfare-content");
  const mainEl = document.getElementById("weather-main");
  const subEl = document.getElementById("weather-sub");
  const locationButton = document.getElementById("location-button");

  if (mainEl) mainEl.textContent = "날씨 확인 중...";
  if (subEl) subEl.textContent = "위치를 불러오고 있습니다";

  const location = await requestUserLocation(forcePrompt);
  let weather = null;

  try {
    weather = await fetchWeather(location.latitude, location.longitude);
    renderWeatherWidget(weather, location.source);
  } catch {
    if (mainEl) mainEl.textContent = "날씨를 불러올 수 없음";
    if (subEl) subEl.textContent = "인터넷 연결을 확인해 주세요";
    locationButton?.classList.remove("hidden");
  }

  if (welfareContainer) {
    try {
      if (!weather) {
        weather = await fetchLocationLabelDirect(location.latitude, location.longitude);
      }
      await loadHomeWelfareInfo(welfareContainer, weather, location.source);
    } catch {
      welfareContainer.innerHTML = `<p class="youtube-loading">복지 정보를 불러오지 못했습니다. search-welfare 함수와 DATA_GO_KR_SERVICE_KEY를 확인해 주세요.</p>`;
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
