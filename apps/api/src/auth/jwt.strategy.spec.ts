import { JwtStrategy } from '@oasis/auth';

describe('JwtStrategy local auth gating', () => {
  const originalEnv = { ...process.env };

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

    expect(() => new JwtStrategy()).toThrow('COGNITO_ISSUER is required when NODE_ENV is not test');
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
