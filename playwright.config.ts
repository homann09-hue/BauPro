import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.PLAYWRIGHT_PORT || process.env.PORT || "3000";
const E2E_HOST = process.env.PLAYWRIGHT_HOST || "127.0.0.1";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://${E2E_HOST}:${E2E_PORT}`;
const shouldStartWebServer = process.env.SKIP_PLAYWRIGHT_WEBSERVER !== "1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  workers: 1,
  ...(shouldStartWebServer
    ? {
        webServer: {
          command: `npm run dev -- --hostname 0.0.0.0 --port ${E2E_PORT}`,
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000
        }
      }
    : {}),
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"]
      }
    }
  ]
});
