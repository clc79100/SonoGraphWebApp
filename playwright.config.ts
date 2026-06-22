import { defineConfig, devices } from "@playwright/test";

// E2E de SonoGraph. Requiere la app corriendo:
//   - Frontend: npm run dev        (http://localhost:8080)
//   - API:      ../SonoGraphAPI npm run start:dev (http://localhost:3000) + Redis + Postgres
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // serie: no saturar la API ni el rate-limit de MusicBrainz
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/smoke.spec.ts"],
    },
    {
      name: "chromium-1920",
      use: { browserName: "chromium", viewport: { width: 1920, height: 1080 } },
      testMatch: ["**/smoke.spec.ts", "**/a11y.spec.ts"],
    },
    {
      name: "chromium-1440",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
      testMatch: ["**/smoke.spec.ts"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testMatch: ["**/smoke.spec.ts"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: ["**/smoke.spec.ts"],
    },
    {
      name: "chromium-ipad",
      use: { ...devices["iPad (gen 7th)"] },
      testMatch: ["**/smoke.spec.ts"],
    },
  ],
});
