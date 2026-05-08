const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

/**
 * Restrict redirects to same-origin app routes.
 */
export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/dashboard",
  origin?: string
) {
  if (!candidate) return fallback;

  const trimmed = candidate.trim();
  if (!trimmed) return fallback;

  // Block protocol-relative and backslash-prefixed variants.
  if (trimmed.startsWith("//") || trimmed.startsWith("\\")) {
    return fallback;
  }

  // Accept app-relative paths.
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  // For absolute URLs, only allow same-origin targets.
  if (ABSOLUTE_URL_RE.test(trimmed) && origin) {
    try {
      const url = new URL(trimmed);
      if (url.origin === origin) {
        return `${url.pathname}${url.search}${url.hash}` || fallback;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}
