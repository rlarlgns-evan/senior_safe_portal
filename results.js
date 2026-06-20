/**
 * 보안 검증 결과 페이지
 */

const STATUS_CONFIG = {
  safe: {
    label: "안전",
    badge: "bg-[#75ff68] text-[#002201]",
    icon: "check_circle",
    card: "bg-[#E8F5E9] border-gray-200",
    title: "text-[#1f1b19]",
    reason: "text-gray-700 bg-gray-50 border-gray-200",
    button: "border-gray-800 shadow-[2px_2px_0px_0px_rgba(31,27,25,1)]",
  },
  warning: {
    label: "주의",
    badge: "bg-[#ffc703] text-[#251a00]",
    icon: "warning",
    card: "bg-orange-50 border-gray-200",
    title: "text-[#1f1b19]",
    reason: "text-gray-700 bg-gray-50 border-gray-200",
    button: "shadow-sm",
  },
  danger: {
    label: "위험",
    badge: "bg-[#ba1a1a] text-white",
    icon: "error",
    card: "bg-[#fff5f5] border-[#ba1a1a] shadow-md",
    title: "text-[#ba1a1a]",
    reason: "text-[#93000a] bg-[#ffdad6] border-[#ba1a1a]",
    button: "border-[#ba1a1a] shadow-[2px_2px_0px_0px_rgba(186,26,26,1)]",
  },
};

const summaryTitle = document.getElementById("results-summary-title");
const resultsList = document.getElementById("results-list");
const resultsError = document.getElementById("results-error");
const resultsLoading = document.getElementById("results-loading");
const searchForm = document.getElementById("results-search-form");
const searchInput = document.getElementById("results-search-input");

function showLoading(show) {
  resultsLoading.classList.toggle("hidden", !show);
  resultsList.classList.toggle("hidden", show);
}

function showError(message) {
  resultsError.textContent = message;
  resultsError.classList.remove("hidden");
}

function hideError() {
  resultsError.classList.add("hidden");
}

function renderThumbnail(item) {
  if (item.thumbnail) {
    return `<img alt="" class="absolute inset-0 w-full h-full object-cover" src="${escapeHtml(item.thumbnail)}" />`;
  }

  return `
    <div class="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200 text-[#a73a00] p-4 text-center">
      <span class="material-symbols-outlined text-5xl mb-2">link</span>
      <span class="text-sm font-bold break-all line-clamp-3">${escapeHtml(item.subtitle || item.title)}</span>
    </div>
  `;
}

function renderResultCard(item) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.safe;
  const borderClass = item.status === "danger" ? "border-[#ba1a1a]" : "border-gray-200";

  return `
    <article class="border ${cfg.card} shadow-sm rounded-lg overflow-hidden flex flex-col md:flex-row md:min-h-[320px]">
      <div class="md:w-[320px] relative h-64 md:h-auto shrink-0 border-b md:border-b-0 md:border-r ${borderClass}">
        ${renderThumbnail(item)}
      </div>
      <div class="p-6 md:p-8 flex-1 flex flex-col">
        <div class="flex items-center gap-3 mb-4">
          <div class="${cfg.badge} px-4 py-1.5 font-bold text-sm rounded-lg flex items-center gap-1 shadow-sm">
            <span class="material-symbols-outlined text-sm font-bold">${cfg.icon}</span>
            ${cfg.label}
          </div>
        </div>
        <h3 class="text-2xl font-bold ${cfg.title} mb-2">${escapeHtml(item.title)}</h3>
        ${item.subtitle ? `<p class="text-sm text-gray-500 mb-4 break-all">${escapeHtml(item.subtitle)}</p>` : ""}
        <p class="text-lg p-4 border rounded mb-6 flex-1 ${cfg.reason}">
          <strong>검증 결과:</strong> ${escapeHtml(item.reason)}
        </p>
        ${item.url && item.status === "safe"
          ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="bg-[#a73a00] text-white w-full md:w-auto self-start px-6 py-2.5 font-bold hover:bg-[#802a00] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 rounded ${cfg.button}">
              링크 열기 <span class="material-symbols-outlined text-sm">open_in_new</span>
            </a>`
          : `<button type="button" class="bg-[#a73a00] text-white w-full md:w-auto self-start px-6 py-2.5 font-bold hover:bg-[#802a00] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 rounded ${cfg.button}">
              자세히 보기 <span class="material-symbols-outlined text-sm">chevron_right</span>
            </button>`
        }
      </div>
    </article>
  `;
}

function renderResults(payload) {
  if (!payload?.items?.length) {
    showError("표시할 검사 결과가 없습니다. 홈에서 다시 검색해 주세요.");
    return;
  }

  summaryTitle.textContent = payload.summary || `총 ${payload.items.length}건을 정밀 검사했습니다.`;
  searchInput.value = payload.query || "";
  resultsList.innerHTML = payload.items.map(renderResultCard).join("");
  resultsList.classList.remove("hidden");
}

async function handleSearchSubmit(event) {
  event.preventDefault();
  hideError();

  const raw = searchInput.value.trim();
  if (!raw) {
    showError("검색어 또는 링크를 입력해 주세요.");
    return;
  }

  showLoading(true);
  try {
    const payload = await runSearch(raw);
    saveSearchResults(payload);
    renderResults(payload);
  } catch (err) {
    showError(`검색 중 문제가 발생했습니다: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const payload = loadSearchResults();
  if (!payload) {
    window.location.replace("index.html");
    return;
  }

  renderResults(payload);
});

searchForm.addEventListener("submit", handleSearchSubmit);
