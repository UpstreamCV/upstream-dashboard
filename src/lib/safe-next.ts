/**
 * Sanitize the `?next=` query parameter used by the login flow.
 *
 * Accepts only same-origin paths. Rejects:
 *  - empty / missing values
 *  - absolute URLs ("https://...", "http://...")
 *  - protocol-relative URLs ("//evil.com")
 *  - backslash tricks ("/\\evil.com")
 *  - anything that doesn't start with "/"
 *
 * Returns the original path when safe, or the fallback otherwise.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.startsWith("/\\")) return fallback;
  // Defense against parser quirks: reject any colon (no schemes allowed).
  if (next.includes(":")) return fallback;
  return next;
}
