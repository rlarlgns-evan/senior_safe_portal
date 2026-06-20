/**
 * 공통 부트스트랩 — layout · auth · page init
 */
document.addEventListener("DOMContentLoaded", () => {
  injectSiteHeader();
  injectLoginModal();
  initSiteNavigation();
  SiteAuth.init();
  injectSiteFooter();

  const page = document.body.dataset.page;
  const browseType = document.body.dataset.browse;
  const chatPages = page === "home" || (page === "browse" && ["youtube", "news", "welfare"].includes(browseType));

  if (chatPages) {
    injectSiteChat();
  }

  initSiteWeather();

  if (page === "home" && typeof initHomePage === "function") initHomePage();
  if (page === "browse" && typeof initBrowsePage === "function") {
    initBrowsePage();
    if (["youtube", "news", "welfare"].includes(browseType)) {
      initSiteChat({
        onLinkResult: () => { window.location.href = "index.html#results"; },
      });
    }
  }
  if (page === "board" && typeof initBoardPage === "function") initBoardPage();
});
