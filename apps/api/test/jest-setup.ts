import { config } from 'dotenv';
import { execSync } from 'child_process';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment (using type assertion to avoid read-only error)
(process.env as any).NODE_ENV = 'test';

// Testcontainers configuration
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true'; // For CI environments
process.env.TESTCONTAINERS_STARTUP_TIMEOUT = '120000'; // 2 minutes

// Global test timeout
jest.setTimeout(120000); // 2 minutes for container-heavy tests

// Cleanup function for tests
(global as any).afterEach(async () => {
  // Cleanup will be handled by individual test suites
});
