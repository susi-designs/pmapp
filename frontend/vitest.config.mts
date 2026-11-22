import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // shadcn/ui components are generated library code
      exclude: ["src/**/*.test.{ts,tsx}", "src/app/**", "src/components/ui/**", "src/test/**"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
