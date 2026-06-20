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

const SENIOR_HOME_YOUTUBE_QUERIES = [
  "시니어 건강 운동",
  "트로트 명곡 모음",
  "어르신 스트레칭",
  "보이스피싱 예방",
  "임영웅 라이브",
  "무릎 관절 운동",
  "국민건강보험 어르신",
  "노년기 두뇌 훈련",
];

function pickSeniorHomeQuery() {
  return SENIOR_HOME_YOUTUBE_QUERIES[Math.floor(Math.random() * SENIOR_HOME_YOUTUBE_QUERIES.length)];
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

async function loadHomeYoutubeRecommendations(container) {
  container.innerHTML = `<p class="youtube-loading">어르신을 위한 안전한 영상을 찾고 있습니다...</p>`;

  try {
    const query = pickSeniorHomeQuery();
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

const SENIOR_HOME_NEWS_QUERIES = [
  "기초연금",
  "어르신 건강",
  "노인 복지",
  "독감 예방접종",
  "시니어 디지털",
  "보이스피싱",
  "국민연금",
];

function pickSeniorHomeNewsQuery() {
  return SENIOR_HOME_NEWS_QUERIES[Math.floor(Math.random() * SENIOR_HOME_NEWS_QUERIES.length)];
}

function renderNewsHomeCard(article) {
  const href = article.originallink || article.link;
  return `
    <a class="news-card-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
      <article class="news-card-ui">
        <div class="news-badge">
          <span class="material-symbols-outlined" style="font-size:20px">verified</span>
          네이버 뉴스
        </div>
        <h4 class="news-title">${escapeHtml(article.title)}</h4>
        <p class="news-summary">${escapeHtml(article.summary)}</p>
        <span class="news-link">${escapeHtml(article.pubDate || "자세히 읽기")} →</span>
      </article>
    </a>
  `;
}

async function loadHomeNewsRecommendations(container) {
  container.innerHTML = `<p class="youtube-loading">오늘의 뉴스를 불러오고 있습니다...</p>`;

  try {
    const query = pickSeniorHomeNewsQuery();
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
