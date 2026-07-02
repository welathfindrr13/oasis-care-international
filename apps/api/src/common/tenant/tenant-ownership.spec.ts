import { BaseHttpException } from '../errors/base-http.exception';
import {
  assertTenantIdForSensitiveWrite,
  assertTenantOwnershipForSensitiveWrite,
} from './tenant-ownership';

describe('tenant sensitive write guards', () => {
  it.each([undefined, null, '', '   '])('rejects missing tenant ids: %p', (organizationId) => {
    expect(() => assertTenantIdForSensitiveWrite('Client', organizationId as any)).toThrow(BaseHttpException);
  });

  it('returns a trimmed tenant id for valid writes', () => {
    expect(assertTenantIdForSensitiveWrite('Visit', ' org-1 ')).toBe('org-1');
  });

  it('accepts direct organization_id ownership on create data', () => {
    expect(
      assertTenantOwnershipForSensitiveWrite('CareLog', {
        organization_id: 'org-1',
      }),
    ).toBe('org-1');
  });

  it('accepts relation connect ownership on Prisma create data', () => {
    expect(
      assertTenantOwnershipForSensitiveWrite('Visit', {
        organization: { connect: { id: 'org-1' } },
      }),
    ).toBe('org-1');
  });

  it('rejects create data that omits tenant ownership', () => {
    expect(() =>
      assertTenantOwnershipForSensitiveWrite('EvidencePack', {
        client: { connect: { id: 'client-1' } },
      }),
    ).toThrow(BaseHttpException);
  });
});
