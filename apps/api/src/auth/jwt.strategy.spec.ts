import { JwtStrategy } from '@oasis/auth';

describe('JwtStrategy local auth gating', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_IDENTITY_PROVIDER;
    delete process.env.CLERK_ISSUER;
    delete process.env.CLERK_JWKS_URL;
    delete process.env.CLERK_AUDIENCE;
    delete process.env.CLERK_AUTHORIZED_PARTIES;
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_CLIENT_ID;
    delete process.env.COGNITO_CLIENT_SECRET;
    delete process.env.LOCAL_AUTH_ENABLED;
    delete process.env.DEV_AUTH_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows local auth strategy without Cognito config in development when enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOCAL_AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'dev-local-auth-secret-32chars-minimum';
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_CLIENT_ID;

    expect(() => new JwtStrategy()).not.toThrow();
  });

  it('rejects local auth in staging even if explicitly enabled', () => {
    process.env.NODE_ENV = 'staging';
    process.env.LOCAL_AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'dev-local-auth-secret-32chars-minimum';

    expect(() => new JwtStrategy()).toThrow(
      'LOCAL_AUTH_ENABLED/DEV_AUTH_ENABLED is not allowed in staging or production',
    );
  });

  it('keeps Cognito requirement when local auth is not enabled', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOCAL_AUTH_ENABLED;
    delete process.env.DEV_AUTH_ENABLED;
    process.env.JWT_SECRET = 'dev-local-auth-secret-32chars-minimum';
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_CLIENT_ID;

    expect(() => new JwtStrategy()).toThrow('COGNITO_ISSUER is required when AUTH_IDENTITY_PROVIDER is cognito');
  });

  it('requires Clerk issuer when Clerk is the production identity provider', () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    delete process.env.LOCAL_AUTH_ENABLED;
    delete process.env.DEV_AUTH_ENABLED;
    delete process.env.CLERK_ISSUER;

    expect(() => new JwtStrategy()).toThrow('CLERK_ISSUER is required when AUTH_IDENTITY_PROVIDER=clerk');
  });

  it('initializes Clerk JWT verification when Clerk issuer is configured', () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER = 'https://clerk.example.org';

    expect(() => new JwtStrategy()).not.toThrow();
  });

  it.each([
    ['org:admin', 'admin'],
    ['org:member', 'carer'],
    ['org:family', 'user'],
  ])('maps Clerk tenant role %s to canonical API role %s', async (orgRole, expectedRole) => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER = 'https://clerk.example.org';
    process.env.CLERK_AUDIENCE = 'oasis-api';
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://care.example.org';

    const strategy = new JwtStrategy();

    await expect(
      strategy.validate({
        sub: 'user_123',
        iss: 'https://clerk.example.org',
        aud: ['oasis-api'],
        azp: 'https://care.example.org',
        org_id: 'org_clerk_123',
        org_role: orgRole,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toMatchObject({
      id: 'user_123',
      organizationId: 'org_clerk_123',
      role: expectedRole,
      authMode: 'clerk',
    });
  });

  it('rejects Clerk tokens without an organization claim', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER = 'https://clerk.example.org';

    const strategy = new JwtStrategy();

    await expect(
      strategy.validate({
        sub: 'user_123',
        iss: 'https://clerk.example.org',
        org_role: 'org:admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toThrow('Clerk token is missing organization claim');
  });

  it('rejects Clerk tokens with unsupported tenant roles', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER = 'https://clerk.example.org';

    const strategy = new JwtStrategy();

    await expect(
      strategy.validate({
        sub: 'user_123',
        iss: 'https://clerk.example.org',
        org_id: 'org_clerk_123',
        org_role: 'org:billing',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toThrow('Clerk token role is missing or unsupported');
  });

  it('rejects Clerk tokens with invalid issuer, audience, or authorized party', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER = 'https://clerk.example.org';
    process.env.CLERK_AUDIENCE = 'oasis-api';
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://care.example.org';

    const strategy = new JwtStrategy();
    const basePayload = {
      sub: 'user_123',
      iss: 'https://clerk.example.org',
      aud: 'oasis-api',
      azp: 'https://care.example.org',
      org_id: 'org_clerk_123',
      org_role: 'org:admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };

    await expect(
      strategy.validate({ ...basePayload, iss: 'https://attacker.example.org' }),
    ).rejects.toThrow('Clerk token issuer is invalid');

    await expect(
      strategy.validate({ ...basePayload, aud: 'wrong-audience' }),
    ).rejects.toThrow('Clerk token audience is invalid');

    await expect(
      strategy.validate({ ...basePayload, azp: 'https://evil.example.org' }),
    ).rejects.toThrow('Clerk token authorized party is invalid');
  });

  it('bypasses Cognito client-id validation for local issuer tokens only', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOCAL_AUTH_ENABLED = 'true';
    process.env.LOCAL_AUTH_ISSUER = 'oasis-local-dev';
    process.env.JWT_SECRET = 'dev-local-auth-secret-32chars-minimum';
    process.env.COGNITO_CLIENT_ID = 'cognito-client-id';

    const strategy = new JwtStrategy();

    await expect(
      strategy.validate({
        sub: 'local-user-1',
        iss: 'oasis-local-dev',
        realm_access: { roles: ['admin'] },
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toMatchObject({
      id: 'local-user-1',
      role: 'admin',
    });
  });

  it('still enforces Cognito client-id validation for non-local issuer tokens', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOCAL_AUTH_ENABLED = 'true';
    process.env.LOCAL_AUTH_ISSUER = 'oasis-local-dev';
    process.env.JWT_SECRET = 'dev-local-auth-secret-32chars-minimum';
    process.env.COGNITO_CLIENT_ID = 'cognito-client-id';

    const strategy = new JwtStrategy();

    await expect(
      strategy.validate({
        sub: 'non-local-token-user',
        iss: 'https://example-issuer',
        realm_access: { roles: ['carer'] },
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toThrow('Token does not match configured Cognito client');
  });
});
