import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    // Pure-TS unit tests today. When we add React component tests, set
    // environment: "jsdom" and add `@testing-library/react`.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
