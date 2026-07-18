import { defineConfig } from "playwright/test";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for the linked-carer browser journey",
  );
}

const localAuthSecret = "local-browser-proof-secret-32-characters";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["linked-carer-assigned-work.spec.ts", "request-access.spec.ts"],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: "output/playwright/linked-carer",
  use: {
    baseURL: "http://localhost:3002",
    browserName: "chromium",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command: "corepack pnpm@9.13.1 --filter @oasis/api dev",
      url: "http://localhost:4000/health",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        JWT_SECRET: localAuthSecret,
        LOCAL_AUTH_JWT_SECRET: localAuthSecret,
        LOCAL_AUTH_ENABLED: "true",
        LOCAL_AUTH_ISSUER: "oasis-local-dev",
        AUTH_IDENTITY_PROVIDER: "clerk",
        TENANT_MEMBERSHIP_REQUIRED: "true",
        MEDICATION_EMAR_ENABLED: "false",
        API_RATE_LIMIT_MAX: "1000",
        PORT: "4000",
        FRONTEND_URL: "http://localhost:3002",
      },
    },
    {
      command: "corepack pnpm@9.13.1 --filter @oasis/web dev",
      url: "http://localhost:3002/login",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NEXTAUTH_URL: "http://localhost:3002",
        NEXTAUTH_SECRET: "local-nextauth-browser-proof-secret-32-characters",
        JWT_SECRET: localAuthSecret,
        LOCAL_AUTH_JWT_SECRET: localAuthSecret,
        LOCAL_AUTH_ENABLED: "true",
        NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true",
        LOCAL_AUTH_ISSUER: "oasis-local-dev",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3002",
        NEXT_PUBLIC_API_URL: "http://localhost:4000/graphql",
      },
    },
  ],
});
