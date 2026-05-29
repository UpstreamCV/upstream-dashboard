import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    // Default to node for fast pure-TS unit tests. Component/hook tests that
    // need React effects, timers, or DOM events opt into jsdom per-file with a
    // `// @vitest-environment jsdom` docblock (see
    // live-perception-overlay-next.test.tsx / use-live-detection-session.test.ts).
    // @testing-library/react + jsdom are installed for those.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
