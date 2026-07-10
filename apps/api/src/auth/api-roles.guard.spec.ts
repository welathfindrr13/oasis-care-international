import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@oasis/auth';
import { AccessContextService, CanonicalAccessContext } from './access-context.service';
import { ApiRolesGuard } from './api-roles.guard';

describe('ApiRolesGuard canonical access', () => {
  afterEach(() => jest.restoreAllMocks());

  const adminAccess: CanonicalAccessContext = {
    authenticated: true,
    authSubject: 'subject-1',
    identityProvider: 'clerk',
    organizationId: 'org-1',
    membershipId: 'membership-1',
    membershipState: 'ACTIVE',
    rawRole: 'admin',
    effectiveRole: 'admin',
    surface: 'ADMIN',
    linkedIdentityState: 'NOT_REQUIRED',
    onboardingState: 'READY',
    domainIdentityId: null,
  };

  function harness(requiredRoles: string[] = []) {
    const reflector = {
      get: jest.fn().mockReturnValue(requiredRoles),
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const accessContextService = {
      resolveForRequest: jest.fn().mockResolvedValue(adminAccess),
      requirePermitted: jest.fn((value) => value),
    } as unknown as AccessContextService;
    const guard = new ApiRolesGuard(reflector, accessContextService);
    const user: any = { id: 'subject-1', role: 'user', realm_access: { roles: ['user', 'org:member'] } };
    const request = { user };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
    jest.spyOn(RolesGuard.prototype, 'canActivate').mockResolvedValue(true);
    return { guard, user, context, accessContextService: accessContextService as any, reflector: reflector as any };
  }

  it('attaches the immutable database access context and overwrites token authority', async () => {
    const { guard, user, context, accessContextService } = harness(['admin']);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(accessContextService.resolveForRequest).toHaveBeenCalledWith(expect.objectContaining({ user }));
    expect(user).toMatchObject({
      role: 'admin',
      organizationId: 'org-1',
      organizationMembershipId: 'membership-1',
      organizationMembershipRole: 'admin',
      accessContext: adminAccess,
    });
  });

  it('delegates repeated guard checks to the shared request cache', async () => {
    const { guard, context, accessContextService } = harness(['admin']);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(accessContextService.resolveForRequest).toHaveBeenCalledTimes(2);
  });

  it('uses the same public denial when the canonical context is not permitted', async () => {
    const { guard, context, accessContextService } = harness();
    accessContextService.requirePermitted.mockImplementation(() => {
      throw new ForbiddenException('Access is unavailable for this account');
    });
    await expect(guard.canActivate(context)).rejects.toEqual(
      new ForbiddenException('Access is unavailable for this account'),
    );
  });

  it('does not let a manager normalized to staff enter a carer-only handler', async () => {
    const { guard, context, accessContextService } = harness(['carer']);
    accessContextService.resolveForRequest.mockResolvedValue({
      ...adminAccess,
      rawRole: 'manager',
      effectiveRole: 'manager',
      surface: 'STAFF',
    });
    await expect(guard.canActivate(context)).rejects.toEqual(new ForbiddenException('Forbidden resource'));
  });

  it('lets a linked operational staff membership use carer handlers', async () => {
    const { guard, context, accessContextService } = harness(['carer']);
    accessContextService.resolveForRequest.mockResolvedValue({
      ...adminAccess,
      rawRole: 'staff',
      effectiveRole: 'carer',
      surface: 'STAFF',
      linkedIdentityState: 'LINKED',
      domainIdentityId: 'carer-1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
