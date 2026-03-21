import { extractRoles, normalizeRole, primaryRole } from './role-utils';

describe('role-utils', () => {
  it('normalizes admin and carer aliases into canonical app roles', () => {
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole('office')).toBe('carer');
    expect(normalizeRole('manager')).toBe('carer');
    expect(normalizeRole('care_manager')).toBe('carer');
  });

  it('extracts canonical roles from Cognito groups', () => {
    expect(
      extractRoles({
        'cognito:groups': ['ADMIN', 'CARE_MANAGER'],
      }),
    ).toEqual(['admin', 'carer']);
  });

  it('falls back to a user role when no supported claims exist', () => {
    expect(primaryRole({})).toBe('user');
  });
});
