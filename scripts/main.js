/**
 * App entry point — layout, auth, page bootstrap
 */
import { SITE_ASSET_VERSION } from "./config.js";
import {
  injectSiteHeader,
  injectLoginModal,
  initSiteNavigation,
  SiteAuth,
  injectSiteFooter,
  initHomeLocationServices,
} from "./ui/core.js";
import { injectSiteChat, initSiteChat } from "./ui/chat.js";
import { pageUrl } from "./paths.js";

const pageModuleUrl = (path) => `${path}?v=${SITE_ASSET_VERSION}`;

document.addEventListener("DOMContentLoaded", async () => {
  try {
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

    if (page === "home") {
      const { initHomePage } = await import(pageModuleUrl("./ui/pages/home.js"));
      initHomePage();
      await initHomeLocationServices();
    }

    if (page === "browse") {
      const { initBrowsePage } = await import(pageModuleUrl("./ui/pages/browse.js"));
      await initBrowsePage();
      if (["youtube", "news", "welfare"].includes(browseType)) {
        initSiteChat({
          onLinkResult: () => { window.location.href = pageUrl("index", { hash: "results" }); },
        });
      }
    }

    if (page === "board") {
      const { initBoardPage } = await import(pageModuleUrl("./ui/pages/board.js"));
      await initBoardPage();
    }
  } catch (err) {
    console.error("App bootstrap failed:", err);
  }
});
