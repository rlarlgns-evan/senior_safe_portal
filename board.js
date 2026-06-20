/**
 * 안전 정보 게시판 — Supabase board_posts 테이블 사용
 */

const BOARD_TABLE = "board_posts";
let currentUser = null;

function formatBoardDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function showBoardFormError(message) {
  const box = document.getElementById("board-form-error");
  const text = document.getElementById("board-form-error-message");
  if (text) text.textContent = message;
  box?.classList.remove("hidden");
}

function hideBoardFormError() {
  document.getElementById("board-form-error")?.classList.add("hidden");
}

function setBoardStatus(message, isError = false) {
  const el = document.getElementById("board-status");
  if (!el) return;
  el.textContent = message;
  el.className = `board-status${isError ? " board-status-error" : ""}${message ? "" : " hidden"}`;
}

function toggleCompose(show) {
  const section = document.getElementById("board-compose");
  section?.classList.toggle("hidden", !show);
  if (!show) {
    document.getElementById("board-form")?.reset();
    hideBoardFormError();
  } else {
    document.getElementById("board-title-input")?.focus();
  }
}

function updateBoardAuthUI(user) {
  currentUser = user;
  const hint = document.getElementById("board-auth-hint");
  const writeBtn = document.getElementById("board-write-btn");

  if (user) {
    if (hint) hint.textContent = `${getUserDisplayName(user)}님, 안전 정보를 공유해 보세요.`;
    writeBtn?.removeAttribute("disabled");
  } else {
    if (hint) hint.textContent = "글을 쓰려면 우측 상단에서 로그인해 주세요.";
    writeBtn?.setAttribute("disabled", "disabled");
    toggleCompose(false);
  }
}

function renderBoardPosts(posts) {
  const list = document.getElementById("board-list");
  if (!list) return;

  if (!posts.length) {
    list.innerHTML = `
      <li class="board-empty">
        ${mascotImg("mascot-loading")}
        <p>아직 올라온 글이 없습니다. 첫 번째 글을 작성해 보세요!</p>
      </li>
    `;
    return;
  }

  list.innerHTML = posts.map((post) => {
    const isOwner = currentUser?.id === post.user_id;
    return `
      <li class="board-item" data-post-id="${escapeHtml(post.id)}">
        <article class="board-card">
          <button type="button" class="board-card-toggle" aria-expanded="false">
            <h2 class="board-card-title">${escapeHtml(post.title)}</h2>
            <p class="board-card-meta">
              <span>${escapeHtml(post.author_name)}</span>
              <span aria-hidden="true">·</span>
              <time datetime="${escapeHtml(post.created_at)}">${escapeHtml(formatBoardDate(post.created_at))}</time>
            </p>
          </button>
          <div class="board-card-body hidden">
            <p class="board-card-content">${escapeHtml(post.content).replace(/\n/g, "<br />")}</p>
            ${isOwner ? `<button type="button" class="board-delete-btn btn btn--danger" data-delete-id="${escapeHtml(post.id)}">내 글 삭제</button>` : ""}
          </div>
        </article>
      </li>
    `;
  }).join("");

  list.querySelectorAll(".board-card-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const body = button.nextElementSibling;
      const open = body?.classList.toggle("hidden") === false;
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  list.querySelectorAll(".board-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const postId = button.dataset.deleteId;
      if (!postId || !confirm("이 글을 삭제할까요?")) return;

      button.disabled = true;
      const { error } = await supabaseClient.from(BOARD_TABLE).delete().eq("id", postId);
      if (error) {
        alert("글 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        button.disabled = false;
        return;
      }
      await loadBoardPosts();
    });
  });
}

async function loadBoardPosts() {
  setBoardStatus("게시글을 불러오는 중...");
  const list = document.getElementById("board-list");
  list.innerHTML = mascotLoadingHtml("게시글을 불러오고 있습니다...");

  const { data, error } = await supabaseClient
    .from(BOARD_TABLE)
    .select("id, user_id, author_name, title, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    list.innerHTML = "";
    const missing = /relation|does not exist|schema cache/i.test(error.message);
    setBoardStatus(
      missing
        ? "게시판 DB가 아직 준비되지 않았습니다. Supabase 대시보드에서 board_posts.sql을 실행해 주세요."
        : "게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      true,
    );
    return;
  }

  setBoardStatus("");
  renderBoardPosts(data ?? []);
}

async function handleBoardSubmit(event) {
  event.preventDefault();
  hideBoardFormError();

  if (!currentUser) {
    SiteAuth.openLoginModal();
    return;
  }

  const title = (document.getElementById("board-title-input")?.value ?? "").trim();
  const content = (document.getElementById("board-content-input")?.value ?? "").trim();

  if (!title) {
    showBoardFormError("제목을 입력해 주세요.");
    return;
  }
  if (!content) {
    showBoardFormError("내용을 입력해 주세요.");
    return;
  }

  const submitBtn = event.submitter ?? event.target.querySelector('[type="submit"]');
  submitBtn.disabled = true;

  const { error } = await supabaseClient.from(BOARD_TABLE).insert({
    user_id: currentUser.id,
    author_name: getUserDisplayName(currentUser),
    title: title.slice(0, 100),
    content: content.slice(0, 2000),
  });

  submitBtn.disabled = false;

  if (error) {
    showBoardFormError("글 등록에 실패했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.");
    return;
  }

  toggleCompose(false);
  await loadBoardPosts();
}

function bindBoardEvents() {
  document.getElementById("board-write-btn")?.addEventListener("click", () => {
    if (!currentUser) {
      SiteAuth.openLoginModal();
      return;
    }
    toggleCompose(true);
  });

  document.getElementById("board-compose-cancel")?.addEventListener("click", () => toggleCompose(false));
  document.getElementById("board-form")?.addEventListener("submit", handleBoardSubmit);
}

async function initBoardPage() {
  bindBoardEvents();

  const { data: { session } } = await supabaseClient.auth.getSession();
  updateBoardAuthUI(session?.user ?? null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateBoardAuthUI(session?.user ?? null);
  });

  await loadBoardPosts();
}

document.addEventListener("DOMContentLoaded", initBoardPage);
