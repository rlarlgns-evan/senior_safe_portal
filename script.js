/**
 * 시니어 디지털 보안관 - 홈(대시보드)
 */

// DOM
const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
const mobileNav = document.getElementById("mobile-nav");
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

// ── 모바일 메뉴 ──

function closeMobileMenu() {
  mobileNav?.classList.add("hidden");
  mobileMenuToggle?.setAttribute("aria-expanded", "false");
}

function toggleMobileMenu() {
  if (!mobileNav) return;
  const willOpen = mobileNav.classList.contains("hidden");
  mobileNav.classList.toggle("hidden", !willOpen);
  mobileMenuToggle?.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

mobileMenuToggle?.addEventListener("click", toggleMobileMenu);

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

// ── 홈 추천 콘텐츠 ──

// ── 검색 → 결과 페이지 ──

async function handleSearchSubmit(event) {
  event.preventDefault();
  hideError();
  closeMobileMenu();

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

// ── 챗봇 (대화형 Agent) ──

const chatHistory = [];

function addChatBubble(text, sender) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

function setChatSubmitting(isSubmitting) {
  const submitButton = chatForm.querySelector(".chat-submit");
  if (submitButton) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "답변 생성 중..." : "메시지 보내기";
  }
  chatInput.disabled = isSubmitting;
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  addChatBubble(text, "user");
  chatInput.value = "";
  chatHistory.push({ role: "user", content: text });

  const thinkingBubble = addChatBubble("보안관이 생각하고 있습니다...", "bot");
  setChatSubmitting(true);

  try {
    const data = await chatWithAgent(text, chatHistory.slice(0, -1));
    thinkingBubble.textContent = data.reply;
    chatHistory.push({ role: "assistant", content: data.reply });

    if (data.linkAnalysis && !Array.isArray(data.linkAnalysis)) {
      const payload = {
        query: data.linkAnalysis.url,
        type: "link",
        summary: data.linkAnalysis.status === "위험"
          ? "⚠️ 챗봇 링크 검사 · 위험 신호 감지"
          : "✅ 챗봇 링크 검사 · 비교적 안전",
        items: [linkAnalysisToItem(data.linkAnalysis, data.linkAnalysis.url)],
      };
      saveSearchResults(payload);

      const detailBubble = document.createElement("div");
      detailBubble.className = "chat-bubble bot chat-action";
      detailBubble.innerHTML = `<button type="button" class="chat-result-link">📋 상세 검사 결과 보기</button>`;
      detailBubble.querySelector("button").addEventListener("click", goToResultsPage);
      chatMessages.appendChild(detailBubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (err) {
    thinkingBubble.textContent = `죄송합니다. 오류가 발생했습니다: ${err.message}`;
    chatHistory.pop();
  } finally {
    setChatSubmitting(false);
  }
}

function toggleChat() {
  chatWindow.classList.toggle("hidden");
  if (!chatWindow.classList.contains("hidden")) chatInput.focus();
}

// ── 네비게이션 ──

function setActiveNav(section) {
  document.querySelectorAll(".top-nav-link, .mobile-nav-link").forEach((el) => {
    const match = el.dataset.section === section;
    el.classList.toggle("nav-active", match && el.classList.contains("top-nav-link"));
    el.classList.toggle("mobile-nav-active", match && el.classList.contains("mobile-nav-link"));
  });
}

document.querySelectorAll("[data-section]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.getAttribute("href") === "#") event.preventDefault();
    setActiveNav(link.dataset.section);
    closeMobileMenu();
    if (link.dataset.section === "consult") chatWindow.classList.remove("hidden");
  });
});

// ── 초기화 ──

document.addEventListener("DOMContentLoaded", () => {
  setupCategoryTabs(
    document.getElementById("youtube-categories"),
    YOUTUBE_CATEGORIES,
    youtubeContent,
    loadHomeYoutubeRecommendations,
  );
  setupCategoryTabs(
    document.getElementById("news-categories"),
    NEWS_CATEGORIES,
    newsContent,
    loadHomeNewsRecommendations,
  );
  initHomeLocationServices();
  addChatBubble("안녕하세요! 저는 시니어 디지털 보안관입니다. 의심스러운 문자, 링크, 전화 사기 등 무엇이든 편하게 물어보세요.", "bot");
  initAuth();
});

const locationButton = document.getElementById("location-button");
if (locationButton) {
  locationButton.addEventListener("click", () => {
    cachedUserLocation = null;
    initHomeLocationServices(true);
  });
}

searchForm.addEventListener("submit", handleSearchSubmit);
errorClose.addEventListener("click", hideError);
chatFab.addEventListener("click", toggleChat);
chatClose.addEventListener("click", () => chatWindow.classList.add("hidden"));
chatForm.addEventListener("submit", handleChatSubmit);
