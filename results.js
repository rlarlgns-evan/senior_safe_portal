/**
 * 보안 검증 결과 페이지 — Persistent alerts only (no auto-dismiss)
 */

const STATUS_CONFIG = {
  safe: {
    label: "안전",
    icon: "check_circle",
    cardBg: "var(--color-success-bg)",
    cardBorder: "var(--color-success)",
    titleColor: "var(--color-success)",
  },
  warning: {
    label: "주의",
    icon: "warning",
    cardBg: "var(--color-warning-bg)",
    cardBorder: "#d97706",
    titleColor: "#92400e",
  },
  danger: {
    label: "위험",
    icon: "error",
    cardBg: "var(--color-danger-bg)",
    cardBorder: "var(--color-danger)",
    titleColor: "var(--color-danger)",
  },
};

const summarySection = document.getElementById("results-summary");
const summaryTitle = document.getElementById("results-summary-title");
const summaryDesc = document.getElementById("results-summary-desc");
const resultsList = document.getElementById("results-list");
const resultsError = document.getElementById("results-error");
const resultsErrorMessage = document.getElementById("results-error-message");
const resultsErrorClose = document.getElementById("results-error-close");
const resultsLoading = document.getElementById("results-loading");
const resultsLoadingCancel = document.getElementById("results-loading-cancel");
const searchForm = document.getElementById("results-search-form");
const searchInput = document.getElementById("results-search-input");

let searchInProgress = false;

function showPersistentLoading(show) {
  resultsLoading.classList.toggle("hidden", !show);
  resultsLoading.setAttribute("aria-hidden", show ? "false" : "true");
  resultsList.style.display = show ? "none" : "flex";
}

function showPersistentError(message) {
  resultsErrorMessage.textContent = message;
  resultsError.classList.remove("hidden");
  resultsError.setAttribute("aria-hidden", "false");
  resultsErrorClose?.focus();
}

function hidePersistentError() {
  resultsError.classList.add("hidden");
  resultsError.setAttribute("aria-hidden", "true");
}

function renderThumbnail(item, cfg) {
  const fallbackId = `thumb-fallback-${Math.random().toString(36).slice(2, 9)}`;

  if (item.thumbnail) {
    const isFavicon = item.thumbnail.includes("google.com/s2/favicons");
    const imgClass = isFavicon ? "result-thumb-logo" : "result-thumb-img";

    return `
      <div class="result-thumb-wrap">
        <img alt="${escapeHtml(item.title)} 미리보기" class="${imgClass}" src="${escapeHtml(item.thumbnail)}"
          onerror="this.classList.add('hidden'); document.getElementById('${fallbackId}').classList.remove('hidden');" />
        <div id="${fallbackId}" class="result-thumb-fallback hidden">
          <span class="material-symbols-outlined">${item.isLink ? "link" : "image"}</span>
          <span>${escapeHtml(item.domain || item.title)}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="result-thumb-fallback">
      <span class="material-symbols-outlined">${item.isLink ? "link" : "play_circle"}</span>
      <span>${escapeHtml(item.domain || item.subtitle || item.title)}</span>
    </div>
  `;
}

function renderResultCard(item) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.safe;

  const actionHtml = item.url && item.status === "safe"
    ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--primary">${item.videoId ? "유튜브에서 보기" : "링크 열기"}</a>`
    : item.url && item.status === "danger"
      ? `<p class="result-danger-note"><span class="material-symbols-outlined">block</span> 위험 링크는 열지 않는 것이 안전합니다.</p>`
      : `<button type="button" class="btn btn--secondary">자세히 보기</button>`;

  return `
    <article class="result-card card" style="background:${cfg.cardBg}; border: var(--btn-border-width) solid ${cfg.cardBorder}; padding: var(--space-card);">
      <div class="result-card-grid">
        <div class="result-thumb-panel">
          ${renderThumbnail(item, cfg)}
          <span class="result-badge" style="background: ${cfg.cardBorder}; color: #fff;">
            <span class="material-symbols-outlined">${cfg.icon}</span>
            ${cfg.label}
          </span>
        </div>
        <div class="result-body">
          ${item.isLink ? `<p class="result-type-label">🔗 링크 검사 결과</p>` : ""}
          <h3 class="result-title" style="color: ${cfg.titleColor}">${escapeHtml(item.title)}</h3>
          ${item.subtitle ? `<p class="result-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
          <p class="result-reason"><strong>검증 결과:</strong> ${escapeHtml(item.reason)}</p>
          ${actionHtml}
        </div>
      </div>
    </article>
  `;
}

function applySummaryStyle(payload) {
  if (payload.type === "link" && payload.items?.[0]) {
    const cfg = STATUS_CONFIG[payload.items[0].status] || STATUS_CONFIG.safe;
    summarySection.style.background = cfg.cardBg;
    summarySection.style.borderColor = cfg.cardBorder;
    summaryTitle.style.color = cfg.titleColor;
    summaryDesc.textContent = payload.items[0].isLink
      ? `검사한 주소: ${payload.items[0].subtitle}`
      : "어르신의 안전을 위해 최신 AI 기술로 분석한 결과입니다.";
    return;
  }

  summarySection.style.background = "#fff";
  summarySection.style.borderColor = "var(--color-border)";
  summaryTitle.style.color = "var(--color-text)";
  summaryDesc.textContent = "어르신의 안전을 위해 최신 AI 기술로 분석한 결과입니다.";
}

function renderResults(payload) {
  if (!payload?.items?.length) {
    showPersistentError("표시할 검사 결과가 없습니다. 홈에서 다시 검색해 주세요.");
    return;
  }

  hidePersistentError();
  applySummaryStyle(payload);
  summaryTitle.textContent = payload.summary || `총 ${payload.items.length}건을 정밀 검사했습니다.`;
  searchInput.value = payload.query || "";
  resultsList.innerHTML = payload.items.map(renderResultCard).join("");
  resultsList.style.display = "flex";
}

async function handleSearchSubmit(event) {
  event.preventDefault();
  if (searchInProgress) return;

  hidePersistentError();

  const raw = searchInput.value.trim();
  if (!raw) {
    showPersistentError("검색어 또는 링크를 입력해 주세요.");
    return;
  }

  searchInProgress = true;
  showPersistentLoading(true);

  try {
    const payload = await runSearch(raw);
    saveSearchResults(payload);
    renderResults(payload);
  } catch (err) {
    showPersistentError(`검색 중 문제가 발생했습니다: ${err.message}`);
  } finally {
    showPersistentLoading(false);
    searchInProgress = false;
  }
}

resultsErrorClose?.addEventListener("click", hidePersistentError);

resultsLoadingCancel?.addEventListener("click", () => {
  showPersistentLoading(false);
  searchInProgress = false;
  showPersistentError("검사를 취소했습니다. 다시 검색해 주세요.");
});

document.addEventListener("DOMContentLoaded", () => {
  const payload = loadSearchResults();
  if (!payload) {
    window.location.replace("index.html");
    return;
  }

  renderResults(payload);
});

searchForm.addEventListener("submit", handleSearchSubmit);
