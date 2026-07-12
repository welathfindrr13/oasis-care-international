import { ForbiddenException } from '@nestjs/common';
import { CanonicalAccessContext } from '../auth/access-context.service';
import { CarerAccessService, requireOperationalActor } from './carer-access.service';

describe('canonical Carer operational actor', () => {
  const linkedCarer: CanonicalAccessContext = {
    authenticated: true,
    authSubject: 'provider-subject-1',
    identityProvider: 'cognito',
    organizationId: 'org-1',
    membershipId: 'membership-1',
    membershipState: 'ACTIVE',
    rawRole: 'carer',
    effectiveRole: 'carer',
    surface: 'STAFF',
    linkedIdentityState: 'LINKED',
    onboardingState: 'READY',
    domainIdentityId: 'domain-carer-1',
  };

  it.each(['carer', 'staff'])('uses the linked domain Carer id for raw %s actors', (rawRole) => {
    const accessContext = { ...linkedCarer, rawRole };
    expect(requireOperationalActor({ accessContext })).toEqual({
      userId: 'domain-carer-1',
      userRole: 'carer',
      organizationId: 'org-1',
      authSubject: 'provider-subject-1',
      accessContext,
    });
  });

  it('preserves the raw membership role and auth subject for a manager', () => {
    const accessContext: CanonicalAccessContext = {
      ...linkedCarer,
      authSubject: 'manager-subject-1',
      rawRole: 'manager',
      effectiveRole: 'manager',
      linkedIdentityState: 'NOT_REQUIRED',
      domainIdentityId: null,
    };
    expect(
      requireOperationalActor({
        accessContext,
      }),
    ).toEqual({
      userId: 'manager-subject-1',
      userRole: 'manager',
      organizationId: 'org-1',
      authSubject: 'manager-subject-1',
      accessContext,
    });
  });

  it('fails closed when the canonical Carer link is unavailable', () => {
    expect(() =>
      requireOperationalActor({
        accessContext: { ...linkedCarer, domainIdentityId: null, linkedIdentityState: 'REQUIRED', surface: 'NONE' },
      }),
    ).toThrow(new ForbiddenException('Active carer membership link is required'));
  });

  it('resolves the compatibility service from the same snapshot without database access', async () => {
    const service = new CarerAccessService();
    await expect(service.requireCarerIdentity({ accessContext: linkedCarer })).resolves.toEqual({
      carerId: 'domain-carer-1',
      authSubject: 'provider-subject-1',
    });
  });
});
