/**
 * 공통 부트스트랩 — layout · auth · page init
 */
document.addEventListener("DOMContentLoaded", () => {
  injectSiteHeader();
  injectLoginModal();
  initSiteNavigation();
  SiteAuth.init();
  injectSiteFooter();
  initSiteWeather();

  const page = document.body.dataset.page;
  if (page === "home" && typeof initHomePage === "function") initHomePage();
  if (page === "browse" && typeof initBrowsePage === "function") initBrowsePage();
  if (page === "board" && typeof initBoardPage === "function") initBoardPage();
});
