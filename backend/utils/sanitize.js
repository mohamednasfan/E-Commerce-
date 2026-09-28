// XSS hardening: plain-text sanitization + safe URL allowlisting.
// Zero-dependency so it works without new npm installs.
// Strategy: all stored string fields are plain text (no rich HTML allowed).
// We strip tags, remove stray < >, null bytes and control chars, then trim/slice.
// React JSX escaping is the primary output encoding; this is defense-in-depth
// so `<script>`, `<img onerror>`, `<svg onload>` can never be stored verbatim.

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const sanitizeText = (value, maxLength = 1000) => {
  if (typeof value !== "string") return "";
  let s = value.replace(/\0/g, "").replace(CONTROL_CHARS_REGEX, "");
  // Strip HTML tags like <script>, <img ...>, <svg ...>. Repeat to catch nested.
  let prev;
  do {
    prev = s;
    s = s.replace(/<[^>]*>/g, "");
  } while (s !== prev);
  // Remove any leftover angle brackets so tag re-formation is impossible.
  s = s.replace(/[<>]/g, "");
  // Break javascript:/data:/vbscript: URL execution in text contexts.
  // We don't drop the whole string (preserve usability), just neutralize the scheme.
  s = s.replace(/javascript\s*:/gi, "javascript&#58;");
  s = s.replace(/data\s*:\s*text\/html/gi, "data&#58;text/html");
  s = s.replace(/vbscript\s*:/gi, "vbscript&#58;");
  return s.trim().slice(0, maxLength);
};

export const sanitizeName = (value, maxLength = 200) =>
  sanitizeText(value, maxLength);

export const sanitizeComment = (value, maxLength = 1000) =>
  sanitizeText(value, maxLength);

export const sanitizeUsername = (value, maxLength = 50) =>
  sanitizeText(value, maxLength);

// Strict rejection helper: returns true if input looks like an XSS attempt
// and must be rejected with 400 instead of silently sanitized.
// Covers: <script>, any <tag>, stray < >, javascript:/data:text/html/vbscript:,
// and inline event handlers (onerror=, onload=, ...). No rich HTML is allowed
// anywhere in plain-text fields (reviews, names, descriptions, etc.).
export const containsXss = (value) => {
  if (typeof value !== "string") return false;
  if (/[<>]/.test(value)) return true;
  if (/javascript\s*:/i.test(value)) return true;
  if (/data\s*:\s*text\/html/i.test(value)) return true;
  if (/vbscript\s*:/i.test(value)) return true;
  if (/\bon\w+\s*=/i.test(value)) return true;
  return false;
};

// Image / URL fields: strict allowlist.
// Allows: "no-image", relative /uploads/... paths, https:// and http:// URLs.
// Rejects: javascript:, data:text/html, data:application/*, vbscript:, blob:, file:,
// strings containing < > " ' ` or whitespace (except encoded %20), control chars.
export const sanitizeImageUrl = (value, fallback = "no-image") => {
  if (typeof value !== "string") return fallback;
  const v = value.replace(/\0/g, "").replace(CONTROL_CHARS_REGEX, "").trim().slice(0, 500);
  if (!v) return fallback;
  if (v === "no-image") return v;
  const lower = v.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/html") ||
    lower.startsWith("data:application/") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:")
  ) {
    return fallback;
  }
  // data:image/... can carry SVG with script; only allow if explicitly needed.
  // Current seeds/uploads use https + /uploads, so reject all data: URLs.
  if (lower.startsWith("data:")) return fallback;
  if (/[<>"'`\s]/.test(v)) {
    // Allow query-string URLs with encoded spaces? No - reject to fallback.
    // Exception: relative /uploads paths never contain spaces.
    return fallback;
  }
  if (v.startsWith("/")) {
    // Only single-leading-slash relative paths (reject //evil.com protocol-relative).
    if (v.startsWith("//")) return fallback;
    return v;
  }
  if (/^https?:\/\/[^\s<>"'`]+$/i.test(v)) return v;
  return fallback;
};

export const sanitizeEmailForHref = (value) => {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "";
  if (/[<>"'`]/.test(v)) return "";
  return v;
};
