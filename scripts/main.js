/**
 * App entry point — layout, auth, page bootstrap
 */
import {
  injectSiteHeader,
  injectLoginModal,
  initSiteNavigation,
  SiteAuth,
  injectSiteFooter,
  initSiteWeather,
} from "./ui/core.js";
import { injectSiteChat, initSiteChat } from "./ui/chat.js";
import { pageUrl } from "./paths.js";

document.addEventListener("DOMContentLoaded", async () => {
  injectSiteHeader();
  injectLoginModal();
  initSiteNavigation();
  await SiteAuth.init();
  injectSiteFooter();

  const page = document.body.dataset.page;
  const browseType = document.body.dataset.browse;
  const chatPages = page === "home" || (page === "browse" && ["youtube", "news", "welfare"].includes(browseType));

  if (chatPages) {
    injectSiteChat();
  }

  initSiteWeather();

  if (page === "home") {
    const { initHomePage } = await import("./ui/pages/home.js");
    initHomePage();
  }

  if (page === "browse") {
    const { initBrowsePage } = await import("./ui/pages/browse.js");
    await initBrowsePage();
    if (["youtube", "news", "welfare"].includes(browseType)) {
      initSiteChat({
        onLinkResult: () => { window.location.href = pageUrl("index", { hash: "results" }); },
      });
    }
  }

  if (page === "board") {
    const { initBoardPage } = await import("./ui/pages/board.js");
    await initBoardPage();
  }
});
