/**
 * 시니어 디지털 보안관 (Senior Digital Sheriff)
 * Frontend Application Logic
 * GitHub Pages 배포용 - Vanilla JS
 */

// ============================================
// Supabase 설정 (마지막 단계에서 연동 — 지금은 비워두세요)
// ============================================
const SUPABASE_URL = 'https://oweduuhfkiutlszfwukt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZWR1dWhma2l1dGxzemZ3dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjMyNzUsImV4cCI6MjA5NzUzOTI3NX0.n25pwv-WuWOBIGY7cwJCYj1TxILYpy2XA2nn7a6ySMY';

/** Supabase 연동 여부 */
const isSupabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Supabase 클라이언트 (키가 있을 때만 생성) */
let supabase = null;

function initSupabaseClient() {
  if (isSupabaseReady && window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

// ============================================
// DOM 요소 참조
// ============================================
const searchView = document.getElementById('search-view');
const resultView = document.getElementById('result-view');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const resultSearchForm = document.getElementById('result-search-form');
const resultSearchInput = document.getElementById('result-search-input');
const youtubeContent = document.getElementById('youtube-content');
const newsContent = document.getElementById('news-content');
const infoContent = document.getElementById('info-content');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

// ============================================
// SPA 라우팅: 화면 전환
// ============================================

/**
 * 큰 검색 영역 숨기고 축소 헤더 표시 (3열 콘텐츠는 그대로 유지)
 */
function showResultView() {
  searchView.classList.add('hidden');
  resultView.classList.remove('hidden');
}

/**
 * 결과 화면 → 검색 화면으로 복귀 (필요 시 사용)
 */
function showSearchView() {
  resultView.classList.add('hidden');
  searchView.classList.remove('hidden');
}

// ============================================
// 유튜브 열 초기 안내 (첫 화면)
// ============================================

/**
 * 검색 전 유튜브 열에 표시할 안내 메시지
 */
function showYoutubePlaceholder() {
  youtubeContent.innerHTML = `
    <div class="youtube-placeholder">
      <span class="youtube-placeholder-icon" aria-hidden="true">📺</span>
      <p>위 검색창에 궁금한 내용을 입력하고<br><strong>「🔍 안전하게 검색하기」</strong>를 눌러 주세요.</p>
      <p style="margin-top:0.75rem;font-size:0.95rem;">보안관 AI가 유튜브 영상을 검증해<br>안전한 영상만 보여드립니다.</p>
    </div>
  `;
}

// ============================================
// 로딩 상태 표시
// ============================================

/**
 * 유튜브 열에 로딩 스피너 표시
 */
function showYoutubeLoading() {
  youtubeContent.innerHTML = `
    <div class="loading-message">
      <div class="loading-spinner" role="status" aria-label="로딩 중"></div>
      <p>안전한 영상을 찾고 있습니다...</p>
    </div>
  `;
}

/**
 * 에러 메시지 표시
 * @param {string} message - 표시할 에러 메시지
 */
function showYoutubeError(message) {
  youtubeContent.innerHTML = `
    <div class="error-message">
      <p>⚠️ ${message}</p>
      <p style="margin-top:0.5rem;font-size:0.9rem;">잠시 후 다시 시도해 주세요.</p>
    </div>
  `;
}

// ============================================
// YouTube 결과 렌더링 (핵심 필터링 로직)
// ============================================

/**
 * Edge Function 응답 데이터를 유튜브 열에 렌더링
 * - status === '안전': 썸네일, 제목, 채널, 링크 표시
 * - status === '위험': 썸네일 숨김, 차단 메시지 + reason 표시
 * @param {Array} videos - Edge Function에서 반환된 영상 배열
 */
function renderYoutubeResults(videos) {
  if (!videos || videos.length === 0) {
    youtubeContent.innerHTML = `
      <div class="loading-message">
        <p>검색 결과가 없습니다. 다른 검색어를 입력해 보세요.</p>
      </div>
    `;
    return;
  }

  const html = videos.map((video) => {
    // 위험 영상: 썸네일 없이 차단 메시지만 표시
    if (video.status === '위험') {
      return `
        <div class="video-blocked">
          <p class="blocked-label">🚨 보안관 차단: 검증되지 않은 정보입니다</p>
          <p class="blocked-reason">${escapeHtml(video.reason || '의심스러운 내용이 감지되었습니다.')}</p>
        </div>
      `;
    }

    // 안전 영상: 썸네일 + 메타데이터 + 링크
    const videoUrl = video.video_id.startsWith('demo-')
      ? 'https://www.youtube.com'
      : `https://www.youtube.com/watch?v=${video.video_id}`;
    const thumbnail = video.thumbnail || (
      video.video_id.startsWith('demo-')
        ? 'https://via.placeholder.com/480x270/0d3b66/ffffff?text=%EC%95%88%EC%A0%84+%EC%98%81%EC%83%81'
        : `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`
    );

    return `
      <article class="video-card">
        <a href="${videoUrl}" target="_blank" rel="noopener noreferrer">
          <img
            class="video-thumbnail"
            src="${escapeHtml(thumbnail)}"
            alt="${escapeHtml(video.title)}"
            loading="lazy"
          >
          <div class="video-info">
            <h3 class="video-title">${escapeHtml(video.title)}</h3>
            <p class="video-channel">${escapeHtml(video.channel || '알 수 없는 채널')}</p>
            <span class="safe-badge">✅ 안전 확인됨</span>
          </div>
        </a>
      </article>
    `;
  }).join('');

  youtubeContent.innerHTML = html;
}

/**
 * XSS 방지를 위한 HTML 이스케이프
 * @param {string} str - 이스케이프할 문자열
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// UI 미리보기용 데모 데이터 (Supabase 연동 전)
// ============================================

/**
 * Supabase 없이 UI/UX 확인용 더미 유튜브 검색 결과
 * @param {string} query - 검색어
 */
function getDemoYoutubeResults(query) {
  return [
    {
      video_id: 'demo-safe-1',
      title: `[안전] ${query} — 건강 정보 가이드`,
      channel: '공신력 있는 건강 채널',
      thumbnail: '',
      status: '안전',
      reason: '',
    },
    {
      video_id: 'demo-danger-1',
      title: '',
      channel: '',
      status: '위험',
      reason: '「100% 치료」, 「즉시 효과」 등 과장 광고 표현이 포함되어 있습니다.',
    },
    {
      video_id: 'demo-safe-2',
      title: `[안전] ${query} — 어르신을 위한 쉬운 설명`,
      channel: '시니어 교육 채널',
      thumbnail: '',
      status: '안전',
      reason: '',
    },
  ];
}

// ============================================
// 검색 실행 (Supabase 또는 데모 모드)
// ============================================

/**
 * search-videos Edge Function 호출 또는 데모 결과 표시
 * @param {string} query - 검색어
 */
async function performSearch(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  showResultView();
  showYoutubeLoading();

  // Supabase 미연동 → 데모 모드 (UI/UX 확인용)
  if (!isSupabaseReady) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    renderYoutubeResults(getDemoYoutubeResults(trimmedQuery));
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('search-videos', {
      body: { query: trimmedQuery },
    });

    if (error) {
      console.error('Edge Function 오류:', error);
      showYoutubeError('검색 중 오류가 발생했습니다.');
      return;
    }

    renderYoutubeResults(data?.videos || data);
  } catch (err) {
    console.error('검색 요청 실패:', err);
    showYoutubeError('네트워크 오류가 발생했습니다.');
  }
}

// ============================================
// 더미 데이터: 뉴스 열 (#col-news)
// ============================================

function renderDummyNews() {
  newsContent.innerHTML = `
    <article class="news-card">
      <h3>🏥 2026년 어르신 건강검진 무료 지원 확대</h3>
      <p>정부가 65세 이상 어르신 대상 무료 건강검진 항목을 확대한다고 발표했습니다. 가까운 보건소에서 신청하실 수 있습니다.</p>
      <p class="news-source">출처: 보건복지부 (공식 보도자료)</p>
    </article>

    <article class="news-card">
      <h3>💰 기초연금 인상, 7월부터 적용</h3>
      <p>2026년 하반기부터 기초연금이 월 5만 원 인상되어 지급됩니다. 별도 신청 없이 자동 적용됩니다.</p>
      <p class="news-source">출처: 국민연금공단</p>
    </article>

    <article class="news-card">
      <h3>🚌 어르신 무료 교통카드 사용처 확대</h3>
      <p>전국 주요 도시에서 65세 이상 어르신 무임 교통 범위가 지하철·시내버스 전 노선으로 확대되었습니다.</p>
      <p class="news-source">출처: 국토교통부</p>
    </article>
  `;
}

// ============================================
// 더미 데이터: 생활 정보 열 (#col-info)
// ============================================

function renderDummyInfo() {
  infoContent.innerHTML = `
    <div class="info-widget">
      <div class="widget-icon">☀️</div>
      <p class="widget-temp">24°C</p>
      <p class="widget-desc">서울 · 맑음 · 미세먼지 좋음</p>
    </div>

    <div class="tip-card">
      <h3>💡 오늘의 보안 팁</h3>
      <p>"무료 점검", "당첨", "긴급 송금" 등의 문자는 100% 사기입니다. 절대 링크를 누르지 마세요!</p>
    </div>

    <div class="tip-card">
      <h3>📞 긴급 신고 전화</h3>
      <p>보이스피싱 신고: <strong>112</strong><br>금융감독원: <strong>1332</strong></p>
    </div>
  `;
}

// ============================================
// AI 챗봇 UI (더미 응답)
// ============================================

/**
 * 챗봇 메시지 버블 추가
 * @param {string} text - 메시지 내용
 * @param {'user'|'bot'} sender - 발신자
 */
function addChatMessage(text, sender) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 더미 스미싱/피싱 분석 응답 (추후 Gemini API 연동 예정)
 * @param {string} userText - 사용자가 붙여넣은 텍스트
 * @returns {string} 분석 결과 메시지
 */
function getDummyChatbotResponse(userText) {
  const lowerText = userText.toLowerCase();

  // 간단한 키워드 기반 더미 판별
  const dangerKeywords = ['당첨', '무료', '긴급', '송금', '계좌', '링크', '클릭', '택배', '미납', '경찰', '검찰', '대출'];
  const foundDanger = dangerKeywords.some((kw) => lowerText.includes(kw) || userText.includes(kw));

  if (foundDanger) {
    return '🚨 위험! 이 메시지는 사기(스미싱)일 가능성이 높습니다. 절대 링크를 누르거나 전화하지 마세요. 가족이나 112에 문의하세요.';
  }

  return '✅ 이 메시지는 특별히 위험한 표현이 발견되지 않았습니다. 그래도 모르는 번호·링크는 누르지 않는 것이 안전합니다.';
}

/**
 * 챗봇 폼 제출 처리
 */
function handleChatSubmit(event) {
  event.preventDefault();

  const userText = chatInput.value.trim();
  if (!userText) return;

  // 사용자 메시지 표시
  addChatMessage(userText, 'user');
  chatInput.value = '';

  // 더미 응답 (약간의 지연으로 자연스러운 UX)
  setTimeout(() => {
    const response = getDummyChatbotResponse(userText);
    addChatMessage(response, 'bot');
  }, 800);
}

// ============================================
// 이벤트 리스너 등록
// ============================================

// 메인 검색 폼 (1단계 화면)
searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value;
  resultSearchInput.value = query; // 결과 화면 검색창에도 동기화
  performSearch(query);
});

// 결과 화면 상단 검색 폼
resultSearchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = resultSearchInput.value;
  searchInput.value = query; // 메인 검색창에도 동기화
  performSearch(query);
});

// AI 챗봇 폼
chatForm.addEventListener('submit', handleChatSubmit);

// ============================================
// 초기화
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initSupabaseClient();
  showYoutubePlaceholder();
  renderDummyNews();
  renderDummyInfo();
  console.log('🛡️ 시니어 디지털 보안관 준비 완료 (UI 미리보기 모드)');
});
