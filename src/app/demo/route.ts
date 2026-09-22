import { NextResponse, type NextRequest } from "next/server";
import { demoCookieOptionsFor, setDemoCookies } from "@/lib/demo/demo-mode.server";
import { DEMO_SCENES, type DemoScene } from "@/lib/demo/scene";

// GET /demo — the public entry point of the embeddable product demo.
//
// Arms runtime demo mode for this browser (the `upstream_demo` cookie; see
// src/lib/demo/demo-mode.ts) and lands on Home. No login, no backend: every
// request that carries the cookie is answered from src/lib/demo/fixtures.
//
// The narrative cursor starts at `counting` — a live camera with a counting
// line and traffic — so the first screen is a populated fleet rather than the
// recording's cold "add a camera" start. `?scene=<beat>` deep-links any other
// beat (the DemoStepper — backtick to reveal — walks them from there).
//
// Public in proxy.ts (PUBLIC_PATHS). Sits outside the (dash) route group so no
// dashboard layout runs for the redirect itself.

export const DEMO_ENTRY_SCENE: DemoScene = "counting";

export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("scene");
  const scene = (DEMO_SCENES as readonly string[]).includes(requested ?? "")
    ? (requested as DemoScene)
    : DEMO_ENTRY_SCENE;

  // A RELATIVE Location, resolved by the browser against the address it
  // actually asked for. NextResponse.redirect() needs an absolute URL, and on
  // Netlify req.nextUrl carries the internal deploy host, so the visitor gets
  // bounced from dashboard.upstreamcv.com to <deploy>--upstream-dashboard.
  // netlify.app — a different origin, where the cookie just set does not
  // apply, landing them on /login instead of the demo.
  const res = new NextResponse(null, {
    status: 307,
    headers: { Location: "/" },
  });
  setDemoCookies(res.cookies, demoCookieOptionsFor(req), scene);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
