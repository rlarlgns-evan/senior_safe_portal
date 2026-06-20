/**
 * 시니어 디지털 보안관 - 대시보드 + 링크 분석
 */

const SUPABASE_URL = "https://oweduuhfkiutlszfwukt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZWR1dWhma2l1dGxzemZ3dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjMyNzUsImV4cCI6MjA5NzUzOTI3NX0.n25pwv-WuWOBIGY7cwJCYj1TxILYpy2XA2nn7a6ySMY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const youtubeContent = document.getElementById("youtube-content");
const newsContent = document.getElementById("news-content");
const resultView = document.getElementById("result-view");
const backButton = document.getElementById("back-button");
const verdictContainer = document.getElementById("verdict-container");
const loadingOverlay = document.getElementById("loading-overlay");
const errorBox = document.getElementById("error-box");
const errorMessage = document.getElementById("error-message");
const errorClose = document.getElementById("error-close");
const chatWindow = document.getElementById("chat-window");
const chatFab = document.getElementById("chat-fab");
const chatClose = document.getElementById("chat-close");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

let lastAnalyzedUrl = "";

// ── 유틸 ──

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
  if (!trimmed) throw new Error("입력값이 비어 있습니다. 검색어 또는 링크를 입력해 주세요.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("http 또는 https로 시작하는 링크만 검사할 수 있습니다.");
  }
  return url.toString();
}

function showLoading() {
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function showError(message) {
  errorMessage.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.classList.add("hidden");
}

function showResultOverlay() {
  resultView.classList.remove("hidden");
}

function hideResultOverlay() {
  resultView.classList.add("hidden");
}

// ── 더미 콘텐츠 ──

function renderDefaultYoutube() {
  const videos = [
    { title: "무릎 관절에 좋은 아침 스트레칭", channel: "건강채널", views: "1.2만회" },
    { title: "미스터트롯 베스트 메들리 1시간", channel: "트로트명가", views: "50만회" },
    { title: "요즘 유행하는 보이스피싱 예방법", channel: "경찰청", views: "10만회" },
    { title: "임영웅 콘서트 라이브 모음", channel: "음악방송", views: "200만회" },
  ];

  youtubeContent.innerHTML = videos.map((v) => `
    <article class="video-card-ui">
      <div class="video-thumb">
        <span class="material-symbols-outlined text-[64px] text-[#1a1a1a] opacity-40">play_circle</span>
        <div class="safe-badge-ui">
          <span class="material-symbols-outlined text-[20px]">check_circle</span> 안전 확인됨
        </div>
      </div>
      <div class="p-5">
        <h4 class="text-[20px] lg:text-[24px] font-bold mb-2 line-clamp-2">${escapeHtml(v.title)}</h4>
        <p class="text-[18px] text-[#4a4a4a]">${escapeHtml(v.channel)} • 조회수 ${escapeHtml(v.views)}</p>
      </div>
    </article>
  `).join("");
}

function renderDemoYoutubeResults(query) {
  const items = [
    { safe: true, title: `[안전] ${query} — 건강 정보`, channel: "공신력 있는 건강 채널" },
    { safe: false, reason: "과장 광고 표현(100% 치료, 즉시 효과)이 감지되었습니다." },
    { safe: true, title: `[안전] ${query} — 어르신 쉬운 설명`, channel: "시니어 교육 채널" },
    { safe: true, title: `[안전] ${query} — 생활 꿀팁`, channel: "생활정보 채널" },
  ];

  youtubeContent.innerHTML = items.map((item) => {
    if (!item.safe) {
      return `
        <div class="blocked-card-ui">
          <p class="text-[20px] font-bold text-[#dc2626] mb-2">🚨 보안관 차단: 검증되지 않은 정보</p>
          <p class="text-[18px] text-[#7f1d1d]">${escapeHtml(item.reason)}</p>
        </div>
      `;
    }
    return `
      <article class="video-card-ui">
        <div class="video-thumb">
          <span class="material-symbols-outlined text-[64px] text-[#1a1a1a] opacity-40">play_circle</span>
          <div class="safe-badge-ui">
            <span class="material-symbols-outlined text-[20px]">check_circle</span> 안전 확인됨
          </div>
        </div>
        <div class="p-5">
          <h4 class="text-[20px] lg:text-[24px] font-bold mb-2">${escapeHtml(item.title)}</h4>
          <p class="text-[18px] text-[#4a4a4a]">${escapeHtml(item.channel)}</p>
        </div>
      </article>
    `;
  }).join("");
}

function renderNews() {
  const articles = [
    {
      title: "올해부터 기초연금 월 33만원으로 인상",
      summary: "65세 이상 어르신 기초연금이 이번 달부터 인상되어 지급됩니다. 신청 방법과 자격 요건을 확인하세요.",
    },
    {
      title: "동절기 독감 무료 예방접종 안내",
      summary: "가까운 보건소에서 신분증을 지참하시면 무료로 독감 예방접종을 받으실 수 있습니다.",
    },
    {
      title: "지하철 노인 무임승차 연령 상향 논의",
      summary: "정부와 지자체가 무임승차 연령을 65세에서 70세로 올리는 방안을 검토 중입니다.",
    },
  ];

  newsContent.innerHTML = articles.map((a) => `
    <article class="news-card-ui p-6 lg:p-8 shadow-md hover:border-[#ff5c00]">
      <div class="flex items-center gap-2 mb-3 text-[#ff5c00]">
        <span class="material-symbols-outlined text-[28px]">verified</span>
        <span class="text-[20px] font-bold">검증된 소식</span>
      </div>
      <h4 class="text-[24px] lg:text-[28px] font-bold mb-3 leading-snug">${escapeHtml(a.title)}</h4>
      <p class="text-[18px] lg:text-[22px] text-[#4a4a4a] mb-4 leading-relaxed">${escapeHtml(a.summary)}</p>
      <span class="text-[#800020] font-bold text-[20px]">자세히 읽기 →</span>
    </article>
  `).join("");
}

// ── 링크 분석 ──

function renderVerdict(result) {
  const status = result?.status === "위험" ? "위험" : "안전";
  const reason = result?.reason || "분석 근거를 가져오지 못했습니다.";

  if (status === "위험") {
    verdictContainer.innerHTML = `
      <div class="verdict-box verdict-danger">
        <p class="verdict-status">🚨 위험 링크로 의심됩니다</p>
        <p class="verdict-reason">${escapeHtml(reason)}</p>
      </div>
    `;
    return;
  }

  verdictContainer.innerHTML = `
    <div class="verdict-box verdict-safe">
      <p class="verdict-status">✅ 안전한 링크로 보입니다</p>
      <p class="verdict-reason">${escapeHtml(reason)}</p>
    </div>
    <button id="open-link-button" type="button" class="open-link-button">이 링크 열기</button>
  `;

  document.getElementById("open-link-button").addEventListener("click", () => {
    window.open(lastAnalyzedUrl, "_blank", "noopener,noreferrer");
  });
}

async function analyzeLink(url) {
  showLoading();
  try {
    const { data, error } = await supabase.functions.invoke("analyze-link", {
      body: { url },
    });

    if (error) throw new Error(error.message || "링크 분석 요청에 실패했습니다.");
    if (!data?.status) throw new Error("분석 결과를 받지 못했습니다. 잠시 후 다시 시도해 주세요.");

    lastAnalyzedUrl = url;
    renderVerdict(data);
    showResultOverlay();
  } catch (err) {
    showError(`링크 검사 중 문제가 발생했습니다: ${err.message}`);
  } finally {
    hideLoading();
  }
}

async function handleSearchSubmit(event) {
  event.preventDefault();
  hideError();

  const raw = searchInput.value.trim();
  if (!raw) {
    showError("검색어 또는 링크를 입력해 주세요.");
    return;
  }

  if (isLikelyUrl(raw)) {
    try {
      const url = normalizeUrl(raw);
      await analyzeLink(url);
    } catch (err) {
      showError(err.message);
    }
    return;
  }

  // 일반 검색어 → 유튜브 데모 결과
  youtubeContent.innerHTML = `<p class="youtube-loading">안전한 영상을 찾고 있습니다...</p>`;
  document.getElementById("youtube-section").scrollIntoView({ behavior: "smooth" });

  await new Promise((r) => setTimeout(r, 700));
  renderDemoYoutubeResults(raw);
}

// ── 챗봇 ──

function addChatBubble(text, sender) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getDummyChatResponse(text) {
  const danger = ["당첨", "무료", "긴급", "송금", "계좌", "링크", "클릭", "택배", "미납", "경찰", "검찰", "대출"];
  if (danger.some((k) => text.includes(k))) {
    return "🚨 위험! 이 메시지는 사기(스미싱)일 가능성이 높습니다. 절대 링크를 누르거나 전화하지 마세요. 112에 문의하세요.";
  }
  return "✅ 특별히 위험한 표현은 발견되지 않았습니다. 그래도 모르는 링크는 누르지 않는 것이 안전합니다.";
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  addChatBubble(text, "user");
  chatInput.value = "";

  if (isLikelyUrl(text)) {
    addChatBubble("링크를 확인하고 있습니다. 잠시만 기다려 주세요...", "bot");
    try {
      const url = normalizeUrl(text);
      const { data, error } = await supabase.functions.invoke("analyze-link", { body: { url } });
      if (error || !data?.status) throw new Error("분석 실패");
      const msg = data.status === "위험"
        ? `🚨 위험 링크입니다. ${data.reason}`
        : `✅ 비교적 안전해 보입니다. ${data.reason}`;
      chatMessages.lastElementChild.textContent = msg;
    } catch {
      chatMessages.lastElementChild.textContent = "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    }
    return;
  }

  setTimeout(() => addChatBubble(getDummyChatResponse(text), "bot"), 600);
}

function toggleChat() {
  chatWindow.classList.toggle("hidden");
  if (!chatWindow.classList.contains("hidden")) {
    chatInput.focus();
  }
}

// ── 네비게이션 ──

function setActiveNav(section) {
  document.querySelectorAll(".nav-link, .mobile-nav-link").forEach((el) => {
    const match = el.dataset.section === section;
    el.classList.toggle("nav-active", match && el.classList.contains("nav-link"));
    el.classList.toggle("mobile-nav-active", match && el.classList.contains("mobile-nav-link"));
  });
}

document.querySelectorAll("[data-section]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.getAttribute("href") === "#") {
      event.preventDefault();
    }
    setActiveNav(link.dataset.section);
    if (link.dataset.section === "consult") {
      chatWindow.classList.remove("hidden");
    }
  });
});

// ── 초기화 ──

function initChatWelcome() {
  addChatBubble("안녕하세요! 디지털 보안관입니다. 의심스러운 문자나 링크를 붙여넣어 주세요.", "bot");
}

document.addEventListener("DOMContentLoaded", () => {
  renderDefaultYoutube();
  renderNews();
  initChatWelcome();
});

searchForm.addEventListener("submit", handleSearchSubmit);
backButton.addEventListener("click", hideResultOverlay);
errorClose.addEventListener("click", hideError);
chatFab.addEventListener("click", toggleChat);
chatClose.addEventListener("click", () => chatWindow.classList.add("hidden"));
chatForm.addEventListener("submit", handleChatSubmit);
