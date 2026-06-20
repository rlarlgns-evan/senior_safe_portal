/**
 * 시니어 디지털 보안관 - 홈(대시보드)
 */

// DOM
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarToggle = document.getElementById("sidebar-toggle");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const youtubeContent = document.getElementById("youtube-content");
const newsContent = document.getElementById("news-content");
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
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const userGreeting = document.getElementById("user-greeting");
const loginModal = document.getElementById("login-modal");
const loginModalClose = document.getElementById("login-modal-close");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

function showLoading() { loadingOverlay.classList.remove("hidden"); }
function hideLoading() { loadingOverlay.classList.add("hidden"); }
function showError(message) { errorMessage.textContent = message; errorBox.classList.remove("hidden"); }
function hideError() { errorBox.classList.add("hidden"); }

// ── 사이드바 (모바일) ──

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.remove("hidden");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.add("hidden");
}

sidebarToggle.addEventListener("click", openSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

// ── 로그인 (Supabase Auth) ──

function updateAuthUI(user) {
  if (user) {
    const name = user.email?.split("@")[0] || "회원";
    userGreeting.textContent = `${name}님`;
    userGreeting.classList.remove("hidden");
    loginButton.classList.add("hidden");
    logoutButton.classList.remove("hidden");
  } else {
    userGreeting.classList.add("hidden");
    loginButton.classList.remove("hidden");
    logoutButton.classList.add("hidden");
  }
}

async function initAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  updateAuthUI(session?.user ?? null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user ?? null);
  });
}

function openLoginModal() {
  loginError.classList.add("hidden");
  loginModal.classList.remove("hidden");
  loginEmail.focus();
}

function closeLoginModal() {
  loginModal.classList.add("hidden");
  loginForm.reset();
}

loginButton.addEventListener("click", openLoginModal);
loginModalClose.addEventListener("click", closeLoginModal);

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.add("hidden");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  });

  if (error) {
    loginError.textContent = `로그인 실패: ${error.message}`;
    loginError.classList.remove("hidden");
    return;
  }

  closeLoginModal();
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

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
        <span class="material-symbols-outlined">play_circle</span>
        <div class="safe-badge-ui">
          <span class="material-symbols-outlined" style="font-size:16px">check_circle</span> 안전 확인됨
        </div>
      </div>
      <div class="card-body">
        <h4 class="card-title">${escapeHtml(v.title)}</h4>
        <p class="card-meta">${escapeHtml(v.channel)} • 조회수 ${escapeHtml(v.views)}</p>
      </div>
    </article>
  `).join("");
}

function renderNews() {
  const articles = [
    { title: "올해부터 기초연금 월 33만원으로 인상", summary: "65세 이상 어르신 기초연금이 이번 달부터 인상되어 지급됩니다." },
    { title: "동절기 독감 무료 예방접종 안내", summary: "가까운 보건소에서 신분증을 지참하시면 무료로 접종받으실 수 있습니다." },
    { title: "지하철 노인 무임승차 연령 상향 논의", summary: "무임승차 연령을 65세에서 70세로 올리는 방안을 검토 중입니다." },
  ];

  newsContent.innerHTML = articles.map((a) => `
    <article class="news-card-ui">
      <div class="news-badge">
        <span class="material-symbols-outlined" style="font-size:20px">verified</span>
        검증된 소식
      </div>
      <h4 class="news-title">${escapeHtml(a.title)}</h4>
      <p class="news-summary">${escapeHtml(a.summary)}</p>
      <span class="news-link">자세히 읽기 →</span>
    </article>
  `).join("");
}

// ── 검색 → 결과 페이지 ──

async function handleSearchSubmit(event) {
  event.preventDefault();
  hideError();
  closeSidebar();

  const raw = searchInput.value.trim();
  if (!raw) {
    showError("검색어 또는 링크를 입력해 주세요.");
    return;
  }

  showLoading();
  try {
    const payload = await runSearch(raw);
    saveSearchResults(payload);
    goToResultsPage();
  } catch (err) {
    showError(`검색 중 문제가 발생했습니다: ${err.message}`);
    hideLoading();
  }
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
    return "🚨 위험! 사기(스미싱)일 가능성이 높습니다. 링크를 누르지 마세요. 112에 문의하세요.";
  }
  return "✅ 특별히 위험한 표현은 없습니다. 모르는 링크는 누르지 않는 것이 안전합니다.";
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  addChatBubble(text, "user");
  chatInput.value = "";

  if (isLikelyUrl(text)) {
    addChatBubble("링크를 확인하고 있습니다...", "bot");
    try {
      const url = normalizeUrl(text);
      const data = await analyzeLink(url);
      const payload = {
        query: text,
        type: "link",
        summary: "링크 1건을 정밀 검사했습니다.",
        items: [linkAnalysisToItem(data, url)],
      };
      saveSearchResults(payload);
      chatMessages.lastElementChild.textContent = data.status === "위험"
        ? `🚨 위험 링크입니다. 결과 페이지로 이동합니다.`
        : `✅ 비교적 안전해 보입니다. 결과 페이지로 이동합니다.`;
      setTimeout(() => goToResultsPage(), 800);
    } catch {
      chatMessages.lastElementChild.textContent = "분석 중 오류가 발생했습니다.";
    }
    return;
  }

  setTimeout(() => addChatBubble(getDummyChatResponse(text), "bot"), 600);
}

function toggleChat() {
  chatWindow.classList.toggle("hidden");
  if (!chatWindow.classList.contains("hidden")) chatInput.focus();
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
    if (link.getAttribute("href") === "#") event.preventDefault();
    setActiveNav(link.dataset.section);
    closeSidebar();
    if (link.dataset.section === "consult") chatWindow.classList.remove("hidden");
  });
});

// ── 초기화 ──

document.addEventListener("DOMContentLoaded", () => {
  renderDefaultYoutube();
  renderNews();
  addChatBubble("안녕하세요! 디지털 보안관입니다. 의심스러운 문자나 링크를 붙여넣어 주세요.", "bot");
  initAuth();
});

searchForm.addEventListener("submit", handleSearchSubmit);
errorClose.addEventListener("click", hideError);
chatFab.addEventListener("click", toggleChat);
chatClose.addEventListener("click", () => chatWindow.classList.add("hidden"));
chatForm.addEventListener("submit", handleChatSubmit);
