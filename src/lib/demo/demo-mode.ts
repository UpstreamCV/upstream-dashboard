// Demo mode — front-end-pure product demo.
//
// When NEXT_PUBLIC_DEMO_MODE === "1", the dashboard runs entirely on fixtures
// with NO backend: no api-server, no Supabase, no WHEP. It's how we record the
// product demo video (see ../../../../upstream-demo/main-demo/). OFF by default —
// nothing in src/lib/demo/ has any effect unless this returns true, and the demo
// code is dead-stripped from prod bundles by the `=== "1"` guard.
//
// NEXT_PUBLIC_* is inlined at build time, so this single helper is valid in RSC,
// Route Handlers, Server Actions, and the browser alike. Keep this module
// dependency-free so it's safe to import from env.ts (which everything imports).

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export function isDemoMode(): boolean {
  return DEMO_MODE;
}
