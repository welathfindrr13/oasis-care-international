import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'clerk-invitation-acceptance.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  outputDir: 'output/playwright/clerk-invitation',
  use: {
    baseURL: 'http://localhost:3003',
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'corepack pnpm@9.13.1 --filter @oasis/web exec next dev -p 3003',
    url: 'http://localhost:3003/accept-invitation',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      AUTH_IDENTITY_PROVIDER: 'clerk',
      NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'clerk',
      OASIS_BROWSER_CLERK_STUB: 'true',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000/graphql',
    },
  },
});
