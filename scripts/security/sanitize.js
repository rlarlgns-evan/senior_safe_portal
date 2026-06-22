export function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

export function decodeHtmlEntities(value) {
  if (value == null || value === "") return "";
  const el = document.createElement("textarea");
  el.innerHTML = String(value);
  return el.value;
}

export function sanitizeNewsText(value, fallback = "") {
  const decoded = decodeHtmlEntities(value);
  return decoded.replace(/\s+/g, " ").trim() || fallback;
}

