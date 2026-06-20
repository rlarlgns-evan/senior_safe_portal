/**
 * 커뮤니티 페이지 — 모바일 메뉴
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("mobile-menu-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  toggle?.addEventListener("click", () => {
    if (!mobileNav) return;
    const willOpen = mobileNav.classList.contains("hidden");
    mobileNav.classList.toggle("hidden", !willOpen);
    toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
});
