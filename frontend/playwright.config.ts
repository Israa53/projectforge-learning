import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  workers: 1,
  reporter: "list",

  use: {
    browserName: "chromium",
    baseURL: "https://localhost:5173",
    ignoreHTTPSErrors: true,
  },

  webServer: [
    {
      name: "ASP.NET E2E",

      cwd: fileURLToPath(
        new URL("../backend/ProjectForge.Api/", import.meta.url),
      ),

      command: "dotnet run --no-launch-profile --urls https://localhost:7050",

      env: {
        ASPNETCORE_ENVIRONMENT: "E2E",
        DOTNET_ENVIRONMENT: "E2E",
        ConnectionStrings__Database: "Data Source=projectforge.e2e.db",
        Jwt__SigningKey: randomBytes(64).toString("base64"),
        Jwt__Issuer: "ProjectForge.E2E",
        Jwt__Audience: "ProjectForge.E2E.Web",
        Jwt__AccessTokenMinutes: "5",
      },

      url: "https://localhost:7050/api/auth/csrf",
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: "React E2E",
      command: "npm run dev",
      url: "https://localhost:5173",
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
