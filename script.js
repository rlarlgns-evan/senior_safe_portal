// Supabase Public 연결 정보
const SUPABASE_URL = "https://oweduuhfkiutlszfwukt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZWR1dWhma2l1dGxzemZ3dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjMyNzUsImV4cCI6MjA5NzUzOTI3NX0.n25pwv-WuWOBIGY7cwJCYj1TxILYpy2XA2nn7a6ySMY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const inputView = document.getElementById("input-view");
const resultView = document.getElementById("result-view");
const analyzeForm = document.getElementById("analyze-form");
const urlInput = document.getElementById("url-input");
const backButton = document.getElementById("back-button");
const verdictContainer = document.getElementById("verdict-container");
const loadingOverlay = document.getElementById("loading-overlay");
const errorBox = document.getElementById("error-box");
const errorMessage = document.getElementById("error-message");
const errorClose = document.getElementById("error-close");

let lastAnalyzedUrl = "";

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
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

function showInputView() {
  inputView.classList.remove("hidden");
  resultView.classList.add("hidden");
}

function showResultView() {
  inputView.classList.add("hidden");
  resultView.classList.remove("hidden");
}

function normalizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("링크가 비어 있습니다. 주소를 입력해 주세요.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("http 또는 https로 시작하는 링크만 검사할 수 있습니다.");
  }

  return url.toString();
}

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
    <button id="open-link-button" class="open-link-button" type="button">이 링크 열기</button>
  `;

  const openLinkButton = document.getElementById("open-link-button");
  openLinkButton.addEventListener("click", () => {
    window.open(lastAnalyzedUrl, "_blank", "noopener,noreferrer");
  });
}

async function handleAnalyzeSubmit(event) {
  event.preventDefault();
  hideError();

  let normalizedUrl = "";
  try {
    normalizedUrl = normalizeUrl(urlInput.value);
  } catch (error) {
    showError(error.message);
    return;
  }

  showLoading();

  try {
    const { data, error } = await supabase.functions.invoke("analyze-link", {
      body: { url: normalizedUrl },
    });

    if (error) {
      throw new Error(error.message || "링크 분석 요청에 실패했습니다.");
    }

    if (!data || !data.status) {
      throw new Error("분석 결과를 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }

    lastAnalyzedUrl = normalizedUrl;
    renderVerdict(data);
    showResultView();
  } catch (error) {
    showError(`링크 검사 중 문제가 발생했습니다: ${error.message}`);
  } finally {
    hideLoading();
  }
}

analyzeForm.addEventListener("submit", handleAnalyzeSubmit);
backButton.addEventListener("click", showInputView);
errorClose.addEventListener("click", hideError);
