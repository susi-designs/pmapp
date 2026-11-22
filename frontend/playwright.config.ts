import { defineConfig } from "@playwright/test";

// Runs against the Docker container: start it first with scripts/start.sh
export default defineConfig({
  workers: 1, // tests will share one database
  testDir: "e2e",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:8001", viewport: { width: 1440, height: 900 } },
});
