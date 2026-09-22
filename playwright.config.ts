import { defineConfig, devices } from "@playwright/test";

const STUB_PORT = 54399;
const APP_PORT = 3100;

/**
 * The suite never talks to the real Supabase: the app is started pointing at
 * tests/fixtures/supabase-stub.mjs. Environment variables that are already set win over
 * .env.local in Next, and tests/global-setup.ts refuses to run anything unless the stub is
 * the one answering.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" },
  },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    locale: "es-EC",
    timezoneId: "America/Guayaquil",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone",
      use: { ...devices["iPhone 14 Pro"], browserName: "chromium" },
      testIgnore: /staff\//,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /staff\/.*\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node tests/fixtures/supabase-stub.mjs",
      url: `http://127.0.0.1:${STUB_PORT}/__hits`,
      reuseExistingServer: !process.env.CI,
      env: { STUB_PORT: String(STUB_PORT) },
    },
    {
      command: `npx next dev -p ${APP_PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${APP_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-test",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${STUB_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "stub-service-role-key",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
