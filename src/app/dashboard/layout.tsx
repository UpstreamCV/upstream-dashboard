import type { Viewport } from "next";
import "./theme.css";
import { satoshi } from "./fonts";

// Browser-chrome tint (mobile address bar / tab UI) for dashboard-next only.
// Next merges viewport down the tree, so this overrides ONLY themeColor for
// this segment; the root layout's viewport (and prod /dashboard's dark
// #1a2613 chrome) is untouched.
export const viewport: Viewport = {
  themeColor: "#4B816C",
};

// Segment-root layout for the redesign. Theme + font wrapper ONLY — no auth,
// no chrome. Auth gating + sidebar/topbar moved down into (app)/layout.tsx so
// the `login/` segment (outside the (app) route group) renders full-bleed with
// no redirect. The Satoshi font module is imported here and nowhere else, so it
// preloads only on dashboard-next routes (prod /dashboard & /(auth) untouched).
export default function DashboardNextLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${satoshi.variable} dashboard-next`}>{children}</div>
  );
}
