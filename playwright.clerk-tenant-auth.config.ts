import { defineConfig } from "playwright/test";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for the Clerk tenant browser proof",
  );
}

const issuer = "http://127.0.0.1:4011";
const audience = "oasis-browser-proof";
const webOrigin = "http://localhost:3004";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "clerk-tenant-auth.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: "output/playwright/clerk-tenant-auth",
  use: {
    baseURL: webOrigin,
    browserName: "chromium",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command: "node tests/browser/fixtures/clerk-jwks-server.mjs",
      url: `${issuer}/health`,
      timeout: 30_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        CLERK_FIXTURE_ISSUER: issuer,
        CLERK_FIXTURE_AUDIENCE: audience,
        CLERK_FIXTURE_AUTHORIZED_PARTY: webOrigin,
      },
    },
    {
      command: "corepack pnpm@9.13.1 --filter @oasis/api dev",
      url: "http://localhost:4001/health",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: databaseUrl,
        AUTH_IDENTITY_PROVIDER: "clerk",
        LOCAL_AUTH_ENABLED: "false",
        CLERK_ISSUER: issuer,
        CLERK_JWKS_URL: `${issuer}/.well-known/jwks.json`,
        CLERK_AUDIENCE: audience,
        CLERK_AUTHORIZED_PARTIES: webOrigin,
        TENANT_MEMBERSHIP_REQUIRED: "true",
        API_RATE_LIMIT_MAX: "1000",
        PORT: "4001",
        FRONTEND_URL: webOrigin,
      },
    },
    {
      command: "corepack pnpm@9.13.1 --filter @oasis/web exec next dev -p 3004",
      url: `${webOrigin}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: "development",
        AUTH_IDENTITY_PROVIDER: "clerk",
        NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: "clerk",
        OASIS_BROWSER_CLERK_STUB: "true",
        NEXT_PUBLIC_API_URL: "http://localhost:4001/graphql",
        NEXT_PUBLIC_SITE_URL: webOrigin,
      },
    },
  ],
});
