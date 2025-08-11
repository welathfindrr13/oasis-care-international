import { getBearerToken as getOriginalBearerToken, getTestJwtSecret, TEST_USERS, TestUser, generateTestToken } from '../jwt.mock';

/**
 * Unified auth helper for E2E tests
 * Provides getBearerToken with support for 'manager' and 'unauth' roles
 */

// Type definition for supported roles
export type TestRole = 'admin' | 'carer' | 'otherCarer' | 'client' | 'manager' | 'unauth';

/**
 * Get bearer token for a test user role
 * @param role - The role to get a token for
 * @returns Bearer token string or empty string for 'unauth'
 */
export function getBearerToken(role: TestRole): string {
  if (role === 'unauth') {
    return '';
  }
  
  // Use the original getBearerToken for known roles
  return getOriginalBearerToken(role as keyof typeof TEST_USERS);
}

// Re-export useful helpers
export { getTestJwtSecret, TEST_USERS, TestUser, generateTestToken };
