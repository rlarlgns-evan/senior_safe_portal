/**
 * 자유게시판 — Supabase board_posts (표 · 검색 · 페이지네이션)
 */

const BOARD_TABLE = "board_posts";
const BOARD_PAGE_SIZE = 10;

let currentUser = null;
let currentPage = 1;
let totalPosts = 0;
let searchQuery = "";
let viewingPostId = null;

function formatBoardDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.className = `board-status${isError ? " board-status-error" : ""}`;
}

function showListView() {
  viewingPostId = null;
  document.getElementById("board-list-view")?.classList.remove("hidden");
  document.getElementById("board-detail")?.classList.add("hidden");
  document.getElementById("board-compose")?.classList.add("hidden");
}

function showDetailView() {
  document.getElementById("board-list-view")?.classList.add("hidden");
  document.getElementById("board-detail")?.classList.remove("hidden");
  document.getElementById("board-compose")?.classList.add("hidden");
}

function toggleCompose(show) {
  const section = document.getElementById("board-compose");
  section?.classList.toggle("hidden", !show);
  if (show) {
    document.getElementById("board-list-view")?.classList.add("hidden");
    document.getElementById("board-detail")?.classList.add("hidden");
    const nameInput = document.getElementById("board-name-input");
    if (nameInput && currentUser && !nameInput.value) {
      nameInput.value = getUserDisplayName(currentUser);
    }
    document.getElementById("board-title-input")?.focus();
  } else {
    document.getElementById("board-form")?.reset();
    hideBoardFormError();
    showListView();
  }
}

function updateBoardAuthUI(user) {
  currentUser = user;
  const hint = document.getElementById("board-auth-hint");
  const writeBtn = document.getElementById("board-write-btn");

  if (user) {
    if (hint) hint.textContent = `${getUserDisplayName(user)}님으로 글을 작성할 수 있습니다.`;
    writeBtn?.removeAttribute("disabled");
  } else {
    if (hint) hint.textContent = "글을 쓰려면 우측 상단에서 로그인해 주세요.";
    writeBtn?.setAttribute("disabled", "disabled");
    toggleCompose(false);
  }
}

function getTotalPages() {
  return Math.max(1, Math.ceil(totalPosts / BOARD_PAGE_SIZE));
}

function updatePaginationUI() {
  const totalPages = getTotalPages();
  const info = document.getElementById("board-page-info");
  const prev = document.getElementById("board-prev");
  const next = document.getElementById("board-next");

  if (info) info.textContent = `${currentPage} page / ${totalPages} pages`;
  if (prev) prev.disabled = currentPage <= 1;
  if (next) next.disabled = currentPage >= totalPages;
}

function renderBoardTable(posts) {
  const tbody = document.getElementById("board-table-body");
  if (!tbody) return;

  if (!posts.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="board-table-empty">등록된 글이 없습니다.</td>
      </tr>
    `;
    return;
  }

  const startNo = totalPosts - (currentPage - 1) * BOARD_PAGE_SIZE;

  tbody.innerHTML = posts.map((post, index) => {
    const no = startNo - index;
    const views = post.view_count ?? 0;
    const authorId = post.author_id || post.author_name || "-";
    return `
      <tr>
        <td class="col-no">${no}</td>
        <td class="col-title">
          <button type="button" class="board-title-link" data-post-id="${escapeHtml(post.id)}">${escapeHtml(post.title)}</button>
        </td>
        <td class="col-name">${escapeHtml(post.author_name)}</td>
        <td class="col-id">${escapeHtml(authorId)}</td>
        <td class="col-date">${escapeHtml(formatBoardDate(post.created_at))}</td>
        <td class="col-views">${views}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".board-title-link").forEach((button) => {
    button.addEventListener("click", () => openPostDetail(button.dataset.postId));
  });
}

async function incrementViewCount(postId) {
  try {
    await supabaseClient.rpc("increment_post_view", { post_id: postId });
  } catch {
    // RPC 미설치 시 조회수 증가 생략
  }
}

async function openPostDetail(postId) {
  if (!postId) return;

  setBoardStatus("글을 불러오는 중...");
  const { data, error } = await supabaseClient
    .from(BOARD_TABLE)
    .select("id, user_id, author_name, author_id, title, content, created_at, view_count")
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) {
    setBoardStatus("글을 불러오지 못했습니다.", true);
    return;
  }

  setBoardStatus("");
  viewingPostId = postId;
  await incrementViewCount(postId);

  const titleEl = document.getElementById("board-detail-title");
  const metaEl = document.querySelector(".board-detail-meta");
  const bodyEl = document.getElementById("board-detail-body");
  const deleteBtn = document.getElementById("board-detail-delete");

  if (titleEl) titleEl.textContent = data.title;
  if (bodyEl) bodyEl.textContent = data.content;

  const authorId = data.author_id || data.author_name || "-";
  const views = (data.view_count ?? 0) + 1;

  if (metaEl) {
    metaEl.innerHTML = `
      <div><dt>이름</dt><dd>${escapeHtml(data.author_name)}</dd></div>
      <div><dt>아이디</dt><dd>${escapeHtml(authorId)}</dd></div>
      <div><dt>작성일</dt><dd>${escapeHtml(formatBoardDate(data.created_at))}</dd></div>
      <div><dt>조회수</dt><dd>${views}</dd></div>
    `;
  }

  if (deleteBtn) {
    const isOwner = currentUser?.id === data.user_id;
    deleteBtn.classList.toggle("hidden", !isOwner);
  }

  showDetailView();
}

async function loadBoardPosts(page = currentPage) {
  currentPage = page;
  const tbody = document.getElementById("board-table-body");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="board-table-empty">게시글을 불러오고 있습니다...</td></tr>`;
  }

  const from = (currentPage - 1) * BOARD_PAGE_SIZE;
  const to = from + BOARD_PAGE_SIZE - 1;

  let query = supabaseClient
    .from(BOARD_TABLE)
    .select("id, user_id, author_name, author_id, title, created_at, view_count", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = searchQuery.trim();
  if (q) {
    const safe = q.replace(/[%_,]/g, " ").trim();
    if (safe) {
      query = query.or(`title.ilike.%${safe}%,author_name.ilike.%${safe}%,author_id.ilike.%${safe}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    if (tbody) tbody.innerHTML = "";
    const missing = /relation|does not exist|schema cache|author_id|view_count/i.test(error.message);
    setBoardStatus(
      missing
        ? "게시판 DB 설정이 필요합니다. Supabase에서 board_posts.sql을 실행해 주세요."
        : "게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      true,
    );
    return;
  }

  totalPosts = count ?? 0;
  setBoardStatus("");
  renderBoardTable(data ?? []);
  updatePaginationUI();
}

async function handleBoardSubmit(event) {
  event.preventDefault();
  hideBoardFormError();

  if (!currentUser) {
    SiteAuth.openLoginModal();
    return;
  }

  const authorName = (document.getElementById("board-name-input")?.value ?? "").trim();
  const title = (document.getElementById("board-title-input")?.value ?? "").trim();
  const content = (document.getElementById("board-content-input")?.value ?? "").trim();

  if (!authorName) {
    showBoardFormError("이름을 입력해 주세요.");
    return;
  }
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
    author_name: authorName.slice(0, 32),
    author_id: getUserDisplayName(currentUser),
    title: title.slice(0, 100),
    content: content.slice(0, 2000),
  });

  submitBtn.disabled = false;

  if (error) {
    showBoardFormError("글 등록에 실패했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.");
    return;
  }

  toggleCompose(false);
  currentPage = 1;
  await loadBoardPosts(1);
}

async function deleteCurrentPost() {
  if (!viewingPostId || !confirm("이 글을 삭제할까요?")) return;

  const { error } = await supabaseClient.from(BOARD_TABLE).delete().eq("id", viewingPostId);
  if (error) {
    alert("글 삭제에 실패했습니다.");
    return;
  }

  showListView();
  await loadBoardPosts(currentPage);
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

  document.getElementById("board-detail-back")?.addEventListener("click", () => {
    showListView();
    loadBoardPosts(currentPage);
  });

  document.getElementById("board-detail-delete")?.addEventListener("click", deleteCurrentPost);

  document.getElementById("board-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    searchQuery = (document.getElementById("board-search-input")?.value ?? "").trim();
    currentPage = 1;
    loadBoardPosts(1);
  });

  document.getElementById("board-prev")?.addEventListener("click", () => {
    if (currentPage > 1) loadBoardPosts(currentPage - 1);
  });

  document.getElementById("board-next")?.addEventListener("click", () => {
    if (currentPage < getTotalPages()) loadBoardPosts(currentPage + 1);
  });
}

async function initBoardPage() {
  bindBoardEvents();

  const { data: { session } } = await supabaseClient.auth.getSession();
  updateBoardAuthUI(session?.user ?? null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateBoardAuthUI(session?.user ?? null);
  });

  await loadBoardPosts(1);
}

document.addEventListener("DOMContentLoaded", initBoardPage);
