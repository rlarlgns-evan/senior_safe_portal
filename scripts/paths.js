/** @file Site path helpers for root vs pages/ HTML locations */

export const PAGES_DIR = "pages";

/** @returns {boolean} */
export function isPagesContext() {
  return document.body?.dataset.pageBase === "pages";
}

/**
 * @param {string} path e.g. "assets/mascot-sheriff.png"
 * @returns {string}
 */
export function assetUrl(path) {
  return isPagesContext() ? `../${path}` : path;
}

/**
 * @param {string} page "index" | "youtube" | "board" | ...
 * @param {{ hash?: string, query?: string }} [opts]
 * @returns {string}
 */
export function pageUrl(page, opts = {}) {
  const { hash = "", query = "" } = opts;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const h = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";

  if (page === "index" || page === "home") {
    return isPagesContext() ? `../index.html${q}${h}` : `index.html${q}${h}`;
  }

  const file = `${page}.html${q}${h}`;
  return isPagesContext() ? file : `${PAGES_DIR}/${file}`;
}

/**
 * @param {string} page
 * @param {string} [categoryId]
 * @returns {string}
 */
export function buildBrowsePageUrl(page, categoryId) {
  const params = new URLSearchParams();
  if (categoryId) params.set("category", categoryId);
  const query = params.toString();
  return pageUrl(page, { query });
}
