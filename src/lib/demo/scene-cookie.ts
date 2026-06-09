import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { coerceScene, DEMO_SCENE_COOKIE, type DemoScene } from "./scene";

// Server-side read of the current demo scene from the `demo_scene` cookie.
// Used by serverFetch (RSC + Server Actions) and the demo router for RSC reads.
// The catch-all proxy Route Handler reads the scene straight off the NextRequest
// it already holds — `coerceScene(req.cookies.get(DEMO_SCENE_COOKIE)?.value)` —
// rather than calling this.
//
// Wrapped in React `cache()` so the per-render fan-out resolves to a single
// cookie read: a Monitor navigation calls serverFetch ~9x in the page plus 2x
// in the [cameraId] layout (each does `await getDemoScene()`), on top of the
// layouts' direct reads — ~13 `await cookies()` per render without this. The
// scene can't change mid-render, so one read per request is correct. Mirrors
// the same `cache()` dedupe already applied to getActiveAccount / validatedSession.
// No-op in production: serverFetch only calls this on the isDemoMode() path.
export const getDemoScene = cache(async (): Promise<DemoScene> => {
  const store = await cookies();
  return coerceScene(store.get(DEMO_SCENE_COOKIE)?.value);
});
