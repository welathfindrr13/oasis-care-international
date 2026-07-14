import { defineConfig } from "playwright/test";

const webPort = 3014;
const apiPort = 4014;
const baseURL = `http://127.0.0.1:${webPort}`;
const localAuthSecret = "accessibility-browser-secret-32-characters";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "accessibility-foundation.spec.ts",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: "output/playwright/accessibility-foundation",
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    locale: "en-GB",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "phone-390x844",
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: "tablet-768x1024",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1440x900",
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "node tests/browser/fixtures/accessibility-api.mjs",
      url: `http://127.0.0.1:${apiPort}/health`,
      timeout: 30_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        ACCESSIBILITY_FIXTURE_API_PORT: String(apiPort),
      },
    },
    {
      command: `corepack pnpm@9.13.1 --filter @oasis/web exec next dev -H 127.0.0.1 -p ${webPort}`,
      url: `${baseURL}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NEXTAUTH_URL: baseURL,
        NEXTAUTH_SECRET: "accessibility-nextauth-secret-32-characters",
        JWT_SECRET: localAuthSecret,
        LOCAL_AUTH_JWT_SECRET: localAuthSecret,
        LOCAL_AUTH_ENABLED: "true",
        NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true",
        LOCAL_AUTH_ISSUER: "oasis-accessibility-fixture",
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}/graphql`,
        OASIS_BROWSER_CLERK_STUB: "true",
      },
    },
  ],
});
