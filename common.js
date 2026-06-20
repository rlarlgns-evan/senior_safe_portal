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
  };
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
