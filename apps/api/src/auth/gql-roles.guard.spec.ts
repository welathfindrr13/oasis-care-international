import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CarerAccessService } from '../carer/carer-access.service';
import { ApiRolesGuard } from './api-roles.guard';
import { GqlRolesGuard } from './gql-roles.guard';

describe('GqlRolesGuard carer membership enforcement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createHarness(requiredRoles: string[], user: Record<string, unknown>) {
    const reflector = {
      get: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
    const prisma = {} as any;
    const carerAccessService = {
      requireCarerIdentity: jest.fn(),
    } as unknown as CarerAccessService;
    const guard = new GqlRolesGuard(reflector, prisma, carerAccessService);
    const request = { user };
    const context = {
      getType: () => 'http',
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    jest.spyOn(ApiRolesGuard.prototype, 'canActivate').mockResolvedValue(true);

    return {
      guard,
      carerAccessService: carerAccessService as any,
      user,
      context,
    };
  }

  it.each(['carer', 'staff'])(
    'requires and attaches the domain Carer link for a raw %s membership',
    async (membershipRole) => {
      const user: any = {
        id: 'provider-subject-1',
        sub: 'provider-subject-1',
        organizationId: 'org-1',
        organizationMembershipId: 'membership-1',
        organizationMembershipRole: membershipRole,
        role: 'carer',
      };
      const { guard, carerAccessService, context } = createHarness(['carer'], user);
      carerAccessService.requireCarerIdentity.mockResolvedValue({
        carerId: 'domain-carer-1',
        authSubject: 'provider-subject-1',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(carerAccessService.requireCarerIdentity).toHaveBeenCalledWith({
        organizationMembershipId: 'membership-1',
        organizationId: 'org-1',
        authSubject: 'provider-subject-1',
      });
      expect(user.carerId).toBe('domain-carer-1');
    },
  );

  it('propagates the sanitized denial when the raw carer membership is unlinked', async () => {
    const user = {
      id: 'provider-subject-1',
      organizationId: 'org-1',
      organizationMembershipId: 'membership-1',
      organizationMembershipRole: 'carer',
      role: 'carer',
    };
    const { guard, carerAccessService, context } = createHarness(['carer'], user);
    carerAccessService.requireCarerIdentity.mockRejectedValue(
      new ForbiddenException('Active carer membership link is required'),
    );

    await expect(guard.canActivate(context)).rejects.toEqual(
      new ForbiddenException('Active carer membership link is required'),
    );
  });

  it('does not let a manager normalized to carer enter a carer-only handler', async () => {
    const user = {
      id: 'manager-subject-1',
      organizationId: 'org-1',
      organizationMembershipId: 'membership-1',
      organizationMembershipRole: 'manager',
      role: 'carer',
    };
    const { guard, carerAccessService, context } = createHarness(['carer'], user);

    await expect(guard.canActivate(context)).rejects.toEqual(new ForbiddenException('Forbidden resource'));
    expect(carerAccessService.requireCarerIdentity).not.toHaveBeenCalled();
  });

  it('preserves an explicitly authorized manager path', async () => {
    const user = {
      id: 'manager-subject-1',
      organizationId: 'org-1',
      organizationMembershipId: 'membership-1',
      organizationMembershipRole: 'manager',
      role: 'carer',
    };
    const { guard, carerAccessService, context } = createHarness(['admin', 'manager', 'carer'], user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(carerAccessService.requireCarerIdentity).not.toHaveBeenCalled();
  });
});
