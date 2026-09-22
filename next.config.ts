import type { NextConfig } from "next";

// Sites allowed to embed the dashboard in an <iframe>. The embeddable product
// demo (/demo) is framed by the marketing/personal site; `frame-ancestors` is
// the only mechanism that can express an allowlist (X-Frame-Options can't, so
// it is deliberately NOT set — it would override this in some browsers).
// 'self' keeps same-origin framing working. Nothing else about the CSP is set
// here, so no other directive is weakened.
const FRAME_ANCESTORS = [
  "'self'",
  "https://elkanbruha.com",
  "https://www.elkanbruha.com",
  "http://localhost:5173",
];

const nextConfig: NextConfig = {
  // Hide the dev-only on-screen route indicator (the bottom-left badge). The
  // product demo is screen-recorded against `next dev`, so the badge would
  // otherwise sit in-frame on every shot. Build/runtime errors are still
  // surfaced (Next 16 devIndicators); no production effect.
  devIndicators: false,
  experimental: {
    // Rewrite `lucide-react` named imports to per-icon module paths so only the
    // icons actually used are bundled (defensive — lucide already tree-shakes,
    // this hardens it and speeds dev compiles).
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${FRAME_ANCESTORS.join(" ")}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
