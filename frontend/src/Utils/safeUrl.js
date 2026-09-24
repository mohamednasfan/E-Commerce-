// Frontend defense-in-depth for Stored XSS.
// Backend now sanitizes + allowlists URLs, but old DB rows may still contain
// `javascript:`, `data:text/html`, or `//evil.com` payloads. React JSX `{ }`
// escapes text, yet `src=`/`href=` attributes still accept attacker strings,
// so guard them before rendering.

export const isSafeImageUrl = (url) => {
  if (typeof url !== "string") return false;
  const v = url.trim();
  if (!v || v === "no-image") return true;
  const lower = v.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/html") ||
    lower.startsWith("data:application/") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:")
  ) {
    return false;
  }
  if (/[<>"'`\s]/.test(v)) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  return /^https?:\/\/[^\s<>"'`]+$/i.test(v);
};

export const safeImageUrl = (url, fallback = "/vite.svg") => {
  if (typeof url !== "string" || !url.trim()) return fallback;
  if (url.trim() === "no-image") return fallback;
  return isSafeImageUrl(url) ? url : fallback;
};

export const safeMailto = (email) => {
  if (typeof email !== "string") return null;
  const v = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  if (/[<>"'`]/.test(v)) return null;
  return `mailto:${v}`;
};
