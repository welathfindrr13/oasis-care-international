import { Reflector } from '@nestjs/core';
import { AccessContextService } from './access-context.service';
import { ApiRolesGuard } from './api-roles.guard';
import { GqlRolesGuard } from './gql-roles.guard';

describe('GqlRolesGuard', () => {
  it('uses the canonical base guard without a second membership lookup', async () => {
    const accessContextService = {} as AccessContextService;
    const guard = new GqlRolesGuard({} as Reflector, accessContextService);
    const context = { getType: () => 'graphql' } as any;
    jest.spyOn(ApiRolesGuard.prototype, 'canActivate').mockResolvedValueOnce(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(ApiRolesGuard.prototype.canActivate).toHaveBeenCalledWith(context);
  });
});
