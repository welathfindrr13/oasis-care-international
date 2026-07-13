import { CarebridgeResolver } from '../../carebridge/carebridge.resolver';
import { ClientResolver } from '../../client/client.resolver';
import { MANUAL_AUDIT_KEY } from '../decorators/manual-audit.decorator';

function hasManualAudit(target: object, methodName: string): boolean {
  const handler = (target as Record<string, unknown>)[methodName];
  return Reflect.getMetadata(MANUAL_AUDIT_KEY, handler as object) === true;
}

describe('authoritative manual audit boundaries', () => {
  it('suppresses generic audit only for CareBridge mutations with transactional domain audits', () => {
    const prototype = CarebridgeResolver.prototype;
    const authoritativeMutations = [
      'createCareRoom',
      'inviteFamilyContact',
      'updateFamilyAccessGrants',
      'revokeFamilyAccess',
      'revokeFamilyInvitation',
      'retryFamilyInvitationDelivery',
      'updateCarebridgePolicy',
      'generateVerifiedVisitStory',
      'publishVerifiedVisitStory',
      'rejectVerifiedVisitStory',
      'raiseCarebridgeConcern',
      'raiseFamilyCarebridgeConcern',
      'updateCarebridgeConcern',
      'submitFamilyPulse',
    ];

    for (const methodName of authoritativeMutations) {
      expect(hasManualAudit(prototype, methodName)).toBe(true);
    }
    expect(hasManualAudit(prototype, 'careRooms')).toBe(false);
    expect(hasManualAudit(prototype, 'carebridgeConcernInbox')).toBe(false);
  });

  it('suppresses generic audit for client mutations but not client queries', () => {
    const prototype = ClientResolver.prototype;

    for (const methodName of ['createClient', 'updateClient', 'deleteClient']) {
      expect(hasManualAudit(prototype, methodName)).toBe(true);
    }
    expect(hasManualAudit(prototype, 'clients')).toBe(false);
    expect(hasManualAudit(prototype, 'client')).toBe(false);
  });
});
