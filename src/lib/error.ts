/**
 * Single chokepoint for "something unexpected happened" reporting. Today it's
 * a `console.error`; swap to Sentry / Logflare / OTel by replacing the body —
 * every callsite in the app already routes through here.
 *
 * Do NOT log raw API tokens, plaintext secrets, or Supabase access tokens.
 * The Supabase access token in particular can ride along in error envelopes
 * from third-party libs; sanitize before forwarding to a remote reporter.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    if (context) {
      console.error("[upstream]", error, context);
    } else {
      console.error("[upstream]", error);
    }
  }
  // Hook a real reporter here in the future (Sentry.captureException(...)).
}
