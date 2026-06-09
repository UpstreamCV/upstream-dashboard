import type { NextConfig } from "next";

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
};

export default nextConfig;
