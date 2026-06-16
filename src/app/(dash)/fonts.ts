import localFont from "next/font/local";

// Satoshi (self-hosted, Fontshare — see fonts/FFL.txt for the license).
//
// SCOPING: this module is imported ONLY by src/app/dashboard-next/layout.tsx.
// next/font preloads a local font only on the route subtree that renders it
// (see node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md
// — "create a utility function that exports a font … preloaded only when it's
// rendered"). The root layout never imports this, so / and /(auth)
// keep their system-font bundles and <head> unchanged.
//
// We expose `.variable` (the CSS-variable method) rather than `.className` so
// theme.css owns the cascade + fallback for the whole .dashboard-next subtree.
export const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  preload: true,
  // Local fonts accept 'Times New Roman' | false (Arial is the google default).
  // We supply our own fallback stack instead, so disable the auto-adjust.
  adjustFontFallback: false,
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
});
