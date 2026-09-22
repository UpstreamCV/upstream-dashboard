import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import {
  DEMO_MODE,
  DEMO_MODE_COOKIE,
  DEMO_MODE_COOKIE_VALUE,
  type DemoCookieOptions,
  demoCookieOptions,
  demoModeFromCookie,
  inferSecure,
} from "./demo-mode";
import { DEMO_SCENE_COOKIE, type DemoScene } from "./scene";

// Server-side demo-mode resolution for RSC, Server Actions and Route Handlers
// that go through next/headers. proxy.ts and the catch-all API proxy already
// hold a NextRequest, so they read `request.cookies` directly instead (see
// demoModeFromCookie in ./demo-mode).
//
// Wrapped in React `cache()` so a render's fan-out (layout + page + every
// serverFetch) resolves to one cookie read — same dedupe as getDemoScene.
// `cookies()` throws when there is no request scope (e.g. a build-time static
// render); that is never a demo, so degrade to the build flag.
export const isDemoMode = cache(async (): Promise<boolean> => {
  if (DEMO_MODE) return true;
  try {
    const store = await cookies();
    return demoModeFromCookie(store.get(DEMO_MODE_COOKIE)?.value);
  } catch {
    return false;
  }
});

/** Cookie attributes for the request that is currently being served. */
export async function demoCookieOptionsForRequest(
  maxAge?: number,
): Promise<DemoCookieOptions> {
  const h = await headers();
  return demoCookieOptions(
    inferSecure(h.get("x-forwarded-proto"), h.get("host")),
    maxAge,
  );
}

/** Same, for handlers that hold the NextRequest. */
export function demoCookieOptionsFor(
  req: NextRequest,
  maxAge?: number,
): DemoCookieOptions {
  return demoCookieOptions(
    inferSecure(
      req.headers.get("x-forwarded-proto"),
      req.headers.get("host"),
      req.nextUrl.protocol,
    ),
    maxAge,
  );
}

type CookieSink = {
  set(name: string, value: string, options: DemoCookieOptions): unknown;
};

/** Arm runtime demo mode: the mode cookie plus the narrative cursor. */
export function setDemoCookies(
  sink: CookieSink,
  options: DemoCookieOptions,
  scene: DemoScene,
): void {
  sink.set(DEMO_MODE_COOKIE, DEMO_MODE_COOKIE_VALUE, options);
  sink.set(DEMO_SCENE_COOKIE, scene, options);
}

/** Leave demo mode. Expires both cookies with matching attributes (see
 *  demoCookieOptions on why a bare delete is not enough inside a frame). */
export function clearDemoCookies(
  sink: CookieSink,
  options: DemoCookieOptions,
): void {
  const expired = { ...options, maxAge: 0 };
  sink.set(DEMO_MODE_COOKIE, "", expired);
  sink.set(DEMO_SCENE_COOKIE, "", expired);
}
