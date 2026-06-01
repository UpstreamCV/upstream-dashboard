import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Rewrite `lucide-react` named imports to per-icon module paths so only the
    // icons actually used are bundled (defensive — lucide already tree-shakes,
    // this hardens it and speeds dev compiles).
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
