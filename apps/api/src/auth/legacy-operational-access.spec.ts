import { ForbiddenException } from '@nestjs/common';
import {
  assertLegacyOperationalAccess,
  getNormalizedAuthRoles,
  isStaffActor,
} from './legacy-operational-access';

describe('legacy operational access hardening', () => {
  it('normalizes role values from role and realm_access claims', () => {
    const roles = getNormalizedAuthRoles({
      role: ' user ',
      realm_access: {
        roles: [' Carer ', 'client', 'client'],
      },
    });

    expect(roles).toEqual(['user', 'carer', 'client']);
  });

  it('treats admin and carer actors as staff', () => {
    expect(
      isStaffActor({
        role: 'admin',
      }),
    ).toBe(true);

    expect(
      isStaffActor({
        role: 'user',
        realm_access: { roles: ['client', 'carer'] },
      }),
    ).toBe(true);
  });

  it('treats client-only and user-only actors as external', () => {
    expect(
      isStaffActor({
        role: 'user',
        realm_access: { roles: ['client'] },
      }),
    ).toBe(false);

    expect(
      isStaffActor({
        role: 'user',
        realm_access: { roles: ['family_contact'] },
      }),
    ).toBe(false);
  });

  it('throws for non-staff actors on legacy operational surfaces', () => {
    expect(() =>
      assertLegacyOperationalAccess({
        role: 'user',
        realm_access: { roles: ['client'] },
      }),
    ).toThrow(ForbiddenException);
  });

  it('does not throw for staff actors on legacy operational surfaces', () => {
    expect(() =>
      assertLegacyOperationalAccess({
        role: 'carer',
        realm_access: { roles: ['carer'] },
      }),
    ).not.toThrow();
  });
});
