"use client";

import { createContext, useContext } from "react";
import { DEMO_MODE } from "./demo-mode";

// Client-side view of demo mode. The server resolves it per request (build
// flag OR `upstream_demo` cookie — see demo-mode.server.ts) and the (app)
// layout hands the boolean down through this provider, so Client Components
// never have to read process.env (which can't see the cookie) or
// document.cookie (which would mismatch the SSR pass).
//
// Default = the build flag, so anything rendered outside the (app) layout
// (e.g. /dashboard-legacy, unit tests) keeps the old build-time behavior.
const DemoModeContext = createContext<boolean>(DEMO_MODE);

export function DemoModeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <DemoModeContext.Provider value={enabled}>{children}</DemoModeContext.Provider>
  );
}

export function useDemoMode(): boolean {
  return useContext(DemoModeContext);
}
