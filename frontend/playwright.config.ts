import process from "node:process";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  workers: 1,

  webServer: {
    command: "npm run dev -- --host localhost",
    url: "https://localhost:5173",
    reuseExistingServer: !process.env.CI,
    ignoreHTTPSErrors: true,
  },

  use: {
    browserName: "chromium",
    baseURL: "https://localhost:5173",
    ignoreHTTPSErrors: true,
  },
});
