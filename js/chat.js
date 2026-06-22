/**
 * 공통 챗봇 — 홈 · 유튜브 · 뉴스 · 복지 페이지
 */

/** @type {Array<{role: string, content: string}>} */
const chatHistory = [];
let siteChatInitialized = false;

const chatDom = {
  get window() { return document.getElementById("chat-window"); },
  get fab() { return document.getElementById("chat-fab"); },
  get close() { return document.getElementById("chat-close"); },
  get form() { return document.getElementById("chat-form"); },
  get input() { return document.getElementById("chat-input"); },
  get messages() { return document.getElementById("chat-messages"); },
};

function getSiteChatHtml() {
  return `
    <div class="chat-fab-wrap" id="floating-chat-container">
      <div id="chat-window" class="chat-window hidden" role="dialog" aria-labelledby="chat-title">
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-header-avatar">
              <img src="assets/mascot-sheriff.png" alt="" class="chat-header-mascot" width="36" height="36" />
            </div>
            <div class="chat-header-text">
              <h3 id="chat-title">보안관 단디</h3>
              <p class="chat-header-status">
                <span class="chat-status-dot" aria-hidden="true"></span>
                상담 가능
              </p>
            </div>
          </div>
          <button type="button" id="chat-close" class="chat-minimize-btn" aria-label="챗봇 최소화">
            <span class="material-symbols-outlined" aria-hidden="true">remove</span>
          </button>
        </div>
        <div id="chat-messages" class="chat-messages" role="log" aria-live="polite"></div>
        <div class="chat-footer">
          <div class="chat-suggestions" role="group" aria-label="빠른 질문">
            <button type="button" class="chat-chip" data-chat-prompt="보이스피싱이 뭐예요? 어떻게 예방하나요?">🛡️ 보이스피싱이 뭐예요?</button>
            <button type="button" class="chat-chip" data-chat-prompt="의심스러운 링크를 받았을 때 어떻게 확인하나요?">🔗 링크 검사법</button>
            <button type="button" class="chat-chip" data-chat-prompt="문자·카톡 사기를 당하지 않으려면 어떻게 해야 하나요?">📱 문자 사기 예방</button>
          </div>
          <form id="chat-form" class="chat-form">
            <label for="chat-input" class="form-label chat-input-label">메시지 또는 링크 입력</label>
            <div class="chat-input-wrap">
              <textarea id="chat-input" rows="1" class="chat-input" autocomplete="off" aria-label="메시지 또는 링크 입력"></textarea>
              <button type="submit" class="chat-send-btn" aria-label="메시지 보내기">
                <span class="material-symbols-outlined" aria-hidden="true">send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
      <button type="button" id="chat-fab" class="chat-fab chat-fab--mascot btn btn--accent">
        <img src="assets/mascot-sheriff.png" alt="" class="chat-fab-img" width="28" height="28" />
        <span>보안관 단디에게 물어보기</span>
      </button>
    </div>
  `;
}

function injectSiteChat() {
  if (document.getElementById("floating-chat-container")) return;
  const host = document.getElementById("app-container") || document.body;
  host.insertAdjacentHTML("beforeend", getSiteChatHtml());
}

function formatChatTime(date = new Date()) {
  return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
}

function createChatUserAvatarElement() {
  const user = typeof SiteAuth?.getCurrentUser === "function" ? SiteAuth.getCurrentUser() : null;
  const avatarUrl = typeof getUserAvatarUrl === "function" ? getUserAvatarUrl(user) : "";

  if (avatarUrl) {
    const photo = document.createElement("img");
    photo.src = avatarUrl;
    photo.alt = `${typeof getUserDisplayName === "function" ? getUserDisplayName(user) : "회원"} 프로필`;
    photo.className = "chat-user-avatar chat-user-avatar--photo";
    photo.loading = "lazy";
    photo.referrerPolicy = "no-referrer";
    photo.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "chat-user-avatar";
      fallback.setAttribute("aria-hidden", "true");
      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined";
      icon.textContent = "person";
      fallback.appendChild(icon);
      photo.replaceWith(fallback);
    }, { once: true });
    return photo;
  }

  const userAvatar = document.createElement("div");
  userAvatar.className = "chat-user-avatar";
  userAvatar.setAttribute("aria-hidden", "true");
  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.textContent = "person";
  userAvatar.appendChild(icon);
  return userAvatar;
}

const SiteChat = {
  onLinkResult: null,

  renderChatBubble(text, sender, options = {}) {
    const row = document.createElement("div");
    row.className = sender === "bot"
      ? "chat-message-row chat-message-row--bot"
      : "chat-message-row chat-message-row--user";

    const content = document.createElement("div");
    content.className = "chat-message-content";

    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = formatChatTime();

    const bubble = document.createElement("div");
    bubble.className = sender === "bot"
      ? `chat-bubble bot${options.featured ? " chat-bubble--featured" : ""}`
      : "chat-bubble user";
    bubble.textContent = String(text ?? "").slice(0, AppConfig.MAX_CHAT_LENGTH);

    if (sender === "bot") {
      const avatar = document.createElement("img");
      avatar.src = MASCOT_SRC;
      avatar.alt = "";
      avatar.className = "chat-mascot-avatar";
      avatar.setAttribute("loading", "lazy");
      content.appendChild(bubble);
      content.appendChild(time);
      row.appendChild(avatar);
      row.appendChild(content);
    } else {
      const userAvatar = createChatUserAvatarElement();
      content.appendChild(bubble);
      content.appendChild(time);
      row.appendChild(content);
      row.appendChild(userAvatar);
    }

    chatDom.messages?.appendChild(row);
    if (chatDom.messages) chatDom.messages.scrollTop = chatDom.messages.scrollHeight;

    return bubble;
  },

  setSubmitting(isSubmitting) {
    const submitButton = chatDom.form?.querySelector(".chat-send-btn");
    if (submitButton) submitButton.disabled = isSubmitting;
    if (chatDom.input) chatDom.input.disabled = isSubmitting;
  },

  renderLinkResultAction() {
    const detailRow = document.createElement("div");
    detailRow.className = "chat-message-row chat-message-row--bot";

    const avatar = document.createElement("img");
    avatar.src = MASCOT_SRC;
    avatar.alt = "";
    avatar.className = "chat-mascot-avatar";
    avatar.setAttribute("loading", "lazy");

    const content = document.createElement("div");
    content.className = "chat-message-content";

    const detailBubble = document.createElement("div");
    detailBubble.className = "chat-bubble bot chat-action";

    const resultButton = document.createElement("button");
    resultButton.type = "button";
    resultButton.className = "chat-action-btn";
    resultButton.textContent = "📋 상세 검사 결과 보기";
    resultButton.addEventListener("click", () => {
      if (typeof SiteChat.onLinkResult === "function") {
        SiteChat.onLinkResult();
      } else {
        window.location.href = "index.html#results";
      }
    });

    detailBubble.appendChild(resultButton);
    content.appendChild(detailBubble);
    detailRow.appendChild(avatar);
    detailRow.appendChild(content);
    chatDom.messages?.appendChild(detailRow);

    if (chatDom.messages) chatDom.messages.scrollTop = chatDom.messages.scrollHeight;
  },

  sendSuggestion(text) {
    if (!chatDom.input || SiteChat.isBusy()) return;
    chatDom.input.value = text;
    chatDom.form?.requestSubmit();
  },

  isBusy() {
    return Boolean(chatDom.form?.querySelector(".chat-send-btn:disabled"));
  },

  async handleChatSubmit(event) {
    event.preventDefault();

    try {
      const text = validateTextInput(
        chatDom.input?.value ?? "",
        AppConfig.MAX_CHAT_LENGTH,
        "메시지를 입력해 주세요.",
      );

      document.getElementById("error-box")?.classList.add("hidden");

      SiteChat.renderChatBubble(text, "user");
      if (chatDom.input) chatDom.input.value = "";
      chatHistory.push({ role: "user", content: text });

      const thinkingBubble = SiteChat.renderChatBubble("단디가 생각하고 있습니다...", "bot");
      SiteChat.setSubmitting(true);

      const data = await chatWithAgent(text, chatHistory.slice(0, -1));
      thinkingBubble.textContent = String(data.reply ?? "").slice(0, AppConfig.MAX_CHAT_LENGTH);
      chatHistory.push({ role: "assistant", content: data.reply });

      if (data.linkAnalysis && !Array.isArray(data.linkAnalysis)) {
        const safeUrl = validateLinkAnalysisUrl(data.linkAnalysis.url);

        if (safeUrl) {
          saveSearchResults({
            query: safeUrl,
            type: "link",
            summary: data.linkAnalysis.status === "위험"
              ? "⚠️ 챗봇 링크 검사 · 위험 신호 감지"
              : "✅ 챗봇 링크 검사 · 비교적 안전",
            items: [linkAnalysisToItem(data.linkAnalysis, safeUrl)],
          });
          SiteChat.renderLinkResultAction();
        }
      }
    } catch (err) {
      chatHistory.pop();
      const lastBotRow = chatDom.messages?.querySelector(".chat-message-row--bot:last-child .chat-bubble");
      if (lastBotRow) {
        lastBotRow.textContent = sanitizeUserFacingMessage(
          err,
          "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      SiteChat.setSubmitting(false);
    }
  },

  toggleChatWindow() {
    chatDom.window?.classList.toggle("hidden");
    if (chatDom.window && !chatDom.window.classList.contains("hidden")) {
      chatDom.input?.focus();
    }
  },

  closeChatWindow() {
    chatDom.window?.classList.add("hidden");
  },

  bindEvents() {
    chatDom.fab?.addEventListener("click", () => SiteChat.toggleChatWindow());
    chatDom.close?.addEventListener("click", () => SiteChat.closeChatWindow());
    chatDom.form?.addEventListener("submit", (e) => SiteChat.handleChatSubmit(e));

    document.querySelectorAll("[data-chat-prompt]").forEach((chip) => {
      chip.addEventListener("click", () => SiteChat.sendSuggestion(chip.dataset.chatPrompt || ""));
    });
  },
};

/**
 * @param {{ onLinkResult?: () => void, openOnLoad?: boolean }} [options]
 */
function initSiteChat(options = {}) {
  if (siteChatInitialized) return;
  siteChatInitialized = true;

  SiteChat.onLinkResult = options.onLinkResult ?? null;
  SiteChat.bindEvents();

  if (!chatDom.messages?.childElementCount) {
    SiteChat.renderChatBubble(
      "안녕하세요! 저는 디지털 보안관 단디예요. 의심스러운 문자, 링크, 전화 사기 등 무엇이든 편하게 물어보세요.",
      "bot",
      { featured: true },
    );
  }

  const shouldOpen = options.openOnLoad
    || new URLSearchParams(window.location.search).get("consult") === "1";

  if (shouldOpen) {
    chatDom.window?.classList.remove("hidden");
    chatDom.input?.focus();
  }
}
