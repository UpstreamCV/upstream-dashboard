// Demo mode — front-end-pure product demo.
//
// When demo mode is on, the dashboard runs entirely on fixtures with NO
// backend: no api-server, no Supabase, no WHEP. Two ways to turn it on:
//
//   1. Build-time: NEXT_PUBLIC_DEMO_MODE=1 (`npm run demo`). The whole build is
//      a demo — how we record the product video (see
//      ../../../../upstream-demo/main-demo/). env.ts relaxes validation on this
//      flag alone, because it is the only one known at build time.
//   2. Runtime: the `upstream_demo` cookie, set by visiting /demo in the NORMAL
//      production build. This is the embeddable demo (the marketing site frames
//      https://dashboard.upstreamcv.com/demo). Each request decides for itself:
//      the server reads the cookie (src/lib/demo/demo-mode.server.ts, proxy.ts,
//      the catch-all API proxy), and Client Components get the resolved value
//      from the (app) layout through <DemoModeProvider> (demo-mode-context.tsx)
//      — never from process.env, which can't see a cookie.
//
// OFF by default — nothing in src/lib/demo/ has any effect unless one of the
// two says so. Keep this module dependency-free and isomorphic (no next/headers,
// no React) so it's safe to import from env.ts, proxy.ts and the browser alike.

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/** Cookie that turns runtime demo mode on for one browser. Not httpOnly: the
 *  client stepper reads its sibling `demo_scene`, and there is nothing secret. */
export const DEMO_MODE_COOKIE = "upstream_demo";
export const DEMO_MODE_COOKIE_VALUE = "1";

/** Demo cookies live a day; /demo re-arms them on every visit. */
export const DEMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

/** True when the build flag is set OR the request carries the demo cookie. */
export function demoModeFromCookie(value: string | null | undefined): boolean {
  return DEMO_MODE || value === DEMO_MODE_COOKIE_VALUE;
}

export type DemoCookieOptions = {
  path: "/";
  sameSite: "none" | "lax";
  secure: boolean;
  maxAge: number;
  partitioned?: boolean;
};

/**
 * Whether the current request arrived over HTTPS. Behind Netlify (and any
 * reverse proxy) the origin sees plain HTTP, so trust `X-Forwarded-Proto`
 * first; fall back to the URL scheme; and treat a bare localhost host as
 * insecure so `next start` on http://localhost still gets usable cookies.
 */
export function inferSecure(
  forwardedProto: string | null | undefined,
  host: string | null | undefined,
  urlProtocol?: string | null,
): boolean {
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (proto === "https") return true;
  if (proto === "http") return false;
  if (urlProtocol === "https:") return true;
  const bareHost = (host ?? "").split(":")[0].toLowerCase();
  if (bareHost === "localhost" || bareHost === "127.0.0.1" || bareHost === "") {
    return false;
  }
  // No proxy header and a real hostname: assume TLS (the production posture).
  return urlProtocol ? urlProtocol === "https:" : true;
}

/**
 * Cookie attributes for every demo cookie (`upstream_demo`, `demo_scene`).
 *
 * The demo is embedded in an <iframe> on a different site, so its cookies are
 * third-party from the browser's point of view: they need `SameSite=None`,
 * which browsers only accept together with `Secure`. Over plain http (local
 * `next start`) `Secure` cookies would be dropped, so fall back to `Lax` —
 * fine for a same-window local check, not for a cross-site frame.
 *
 * `SameSite=None` alone is not enough: browsers that block third-party
 * cookies (Chrome's Tracking Protection, Safari, Firefox) drop it inside the
 * frame, and the demo falls back to the login screen. `Partitioned` (CHIPS)
 * is the opt-in that keeps it working — the cookie is scoped to the embedding
 * site, which is exactly what a per-visitor demo wants. Verified: without it
 * the framed demo lands on /login while the same URL works in a top-level tab.
 *
 * `maxAge: 0` (clearing) must carry the SAME attributes, or Chrome refuses the
 * deletion inside the frame ("SameSite=Lax … came from a cross-site response").
 */
export function demoCookieOptions(
  secure: boolean,
  maxAge: number = DEMO_COOKIE_MAX_AGE_SECONDS,
): DemoCookieOptions {
  return {
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
    maxAge,
    // Partitioned requires Secure; on the plain-http fallback it is invalid.
    partitioned: secure,
  };
}
