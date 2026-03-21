import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps Cognito groups into canonical resolver roles', async () => {
    const strategy = new JwtStrategy();

    await expect(
      strategy.validate({
        sub: 'user-123',
        preferred_username: 'boss',
        'cognito:groups': ['ADMIN'],
        exp: 1,
        iat: 1,
      } as any),
    ).resolves.toMatchObject({
      id: 'user-123',
      role: 'admin',
      roles: ['admin'],
      realm_access: { roles: ['admin'] },
      username: 'boss',
    });
  });
});
