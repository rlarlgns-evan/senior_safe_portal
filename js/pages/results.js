/**
 * 검사 결과 렌더링 (SPA · 공유 모듈)
 */

const RESULTS_STATUS_CONFIG = {
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
    cardBorder: "var(--color-warning-border)",
    titleColor: "var(--color-warning-text)",
  },
  danger: {
    label: "위험",
    icon: "error",
    cardBg: "var(--color-danger-bg)",
    cardBorder: "var(--color-danger)",
    titleColor: "var(--color-danger)",
  },
};

const ResultsModule = {
  els() {
    return {
      summary: document.getElementById("results-summary"),
      summaryTitle: document.getElementById("results-summary-title"),
      summaryDesc: document.getElementById("results-summary-desc"),
      list: document.getElementById("results-list"),
      error: document.getElementById("results-error"),
      errorMessage: document.getElementById("results-error-message"),
      errorClose: document.getElementById("results-error-close"),
      loading: document.getElementById("results-loading"),
      loadingCancel: document.getElementById("results-loading-cancel"),
      searchInput: document.getElementById("results-search-input"),
    };
  },

  showLoading(show) {
    const { loading, list } = this.els();
    loading?.classList.toggle("hidden", !show);
    loading?.setAttribute("aria-hidden", show ? "false" : "true");
    if (list) list.style.display = show ? "none" : "flex";
  },

  showError(message) {
    const { error, errorMessage, errorClose } = this.els();
    if (errorMessage) errorMessage.textContent = message;
    error?.classList.remove("hidden");
    error?.setAttribute("aria-hidden", "false");
    errorClose?.focus();
  },

  hideError() {
    const { error } = this.els();
    error?.classList.add("hidden");
    error?.setAttribute("aria-hidden", "true");
  },

  renderThumbnail(item) {
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
  },

  renderResultCard(item) {
    const cfg = RESULTS_STATUS_CONFIG[item.status] || RESULTS_STATUS_CONFIG.safe;

    const actionHtml = item.url && item.status === "safe"
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--primary">${item.videoId ? "유튜브에서 보기" : "링크 열기"}</a>`
      : item.url && item.status === "danger"
        ? `<p class="result-danger-note"><span class="material-symbols-outlined">block</span> 위험 링크는 열지 않는 것이 안전합니다.</p>`
        : `<button type="button" class="btn btn--secondary">자세히 보기</button>`;

    return `
      <article class="result-card card" style="background:${cfg.cardBg}; border: var(--btn-border-width) solid ${cfg.cardBorder}; padding: var(--space-card);">
        <div class="result-card-grid">
          <div class="result-thumb-panel">
            ${this.renderThumbnail(item)}
            <span class="result-badge" style="background: ${cfg.cardBorder}; color: var(--color-text-on-primary);">
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
  },

  applySummaryStyle(payload) {
    const { summary, summaryTitle, summaryDesc } = this.els();
    if (!summary || !summaryTitle || !summaryDesc) return;

    if (payload.type === "link" && payload.items?.[0]) {
      const cfg = RESULTS_STATUS_CONFIG[payload.items[0].status] || RESULTS_STATUS_CONFIG.safe;
      summary.style.background = cfg.cardBg;
      summary.style.borderColor = cfg.cardBorder;
      summaryTitle.style.color = cfg.titleColor;
      summaryDesc.textContent = payload.items[0].isLink
        ? `검사한 주소: ${payload.items[0].subtitle}`
        : "어르신의 안전을 위해 최신 AI 기술로 분석한 결과입니다.";
      return;
    }

    summary.style.background = "var(--color-surface)";
    summary.style.borderColor = "var(--color-border)";
    summaryTitle.style.color = "var(--color-text)";
    summaryDesc.textContent = "어르신의 안전을 위해 최신 AI 기술로 분석한 결과입니다.";
  },

  render(payload) {
    const { summaryTitle, searchInput, list } = this.els();

    if (!payload?.items?.length) {
      this.showError("표시할 검사 결과가 없습니다. 홈에서 다시 검색해 주세요.");
      return;
    }

    this.hideError();
    this.applySummaryStyle(payload);
    if (summaryTitle) {
      summaryTitle.textContent = payload.summary || `총 ${payload.items.length}건을 정밀 검사했습니다.`;
    }
    if (searchInput) searchInput.value = payload.query || "";
    if (list) {
      list.innerHTML = payload.items.map((item) => this.renderResultCard(item)).join("");
      list.style.display = "flex";
    }
  },

  renderFromStorage() {
    const payload = loadSearchResults();
    if (payload) this.render(payload);
  },

  async handleSearchSubmit(event) {
    event.preventDefault();
    if (ResultsModule._busy) return;

    this.hideError();

    try {
      const { searchInput } = this.els();
      const query = validateTextInput(
        searchInput?.value ?? "",
        AppConfig.MAX_SEARCH_LENGTH,
        "검색어 또는 링크를 입력해 주세요.",
      );

      ResultsModule._busy = true;
      this.showLoading(true);

      const payload = await runSearch(query);
      saveSearchResults(payload);
      this.render(payload);
    } catch (err) {
      this.showError(sanitizeUserFacingMessage(err, "검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      this.showLoading(false);
      ResultsModule._busy = false;
    }
  },

  handleLoadingCancel() {
    this.showLoading(false);
    ResultsModule._busy = false;
    this.showError("검사를 취소했습니다. 다시 검색해 주세요.");
  },

  bindEvents() {
    const { errorClose, loadingCancel } = this.els();
    document.getElementById("results-search-form")?.addEventListener("submit", (e) => this.handleSearchSubmit(e));
    errorClose?.addEventListener("click", () => this.hideError());
    loadingCancel?.addEventListener("click", () => this.handleLoadingCancel());
  },
};

ResultsModule._busy = false;
