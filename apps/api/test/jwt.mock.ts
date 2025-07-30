import * as jwt from 'jsonwebtoken';

// Test JWT secret (NEVER use in production)
const TEST_JWT_SECRET = 'test-secret-key-for-oasis-testing-only';

export interface TestUser {
  sub: string;
  preferred_username: string;
  realm_access: {
    roles: string[];
  };
}

// Test users
export const TEST_USERS = {
  admin: {
    sub: 'admin-123',
    preferred_username: 'admin.user',
    realm_access: {
      roles: ['admin'],
    },
  },
  carer: {
    sub: 'carer-123',
    preferred_username: 'jane.doe',
    realm_access: {
      roles: ['carer'],
    },
  },
  otherCarer: {
    sub: 'carer-456',
    preferred_username: 'john.smith',
    realm_access: {
      roles: ['carer'],
    },
  },
  client: {
    sub: 'client-123',
    preferred_username: 'mary.jones',
    realm_access: {
      roles: ['client'],
    },
  },
};

// Generate test JWT tokens
export function generateTestToken(user: TestUser): string {
  return jwt.sign(
    {
      ...user,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
    TEST_JWT_SECRET
  );
}

// Get bearer token for a test user
export function getBearerToken(userType: keyof typeof TEST_USERS): string {
  const user = TEST_USERS[userType];
  const token = generateTestToken(user);
  return `Bearer ${token}`;
}

// Export the secret for JWT strategy in tests
export const getTestJwtSecret = () => TEST_JWT_SECRET;
