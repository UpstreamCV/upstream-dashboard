import type { Viewport } from "next";
import "./theme.css";
import { satoshi } from "./fonts";

// Browser-chrome tint (mobile address bar / tab UI) for the dashboard only.
// Next merges viewport down the tree, so this overrides ONLY themeColor for
// this route group; the root layout's viewport is untouched.
export const viewport: Viewport = {
  themeColor: "#161616",
};

// Route-group root layout for the dashboard (now mounted at "/" — the (dash)
// group adds no URL segment). Theme + font wrapper ONLY — no auth, no chrome.
// Auth gating + sidebar/topbar live in (app)/layout.tsx so the `login/` segment
// (outside the (app) route group, i.e. /login) renders full-bleed with no
// redirect. Satoshi is imported here and nowhere else, so it preloads only on
// the dashboard routes (the legacy fallback + select-account are untouched).
export default function DashboardNextLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${satoshi.variable} dashboard-next`}>{children}</div>
  );
}
