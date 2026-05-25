import { AiSummaryResolver } from '../src/ai-summary/ai-summary.resolver';
import { CarerResolver } from '../src/carer/carer.resolver';
import { CareLogResolver } from '../src/care-log/care-log.resolver';
import { CarePlanningResolver } from '../src/care-planning/care-planning.resolver';
import { ClientResolver } from '../src/client/client.resolver';
import {
  LEGACY_OPERATIONAL_SURFACE_KEY,
} from '../src/auth/legacy-operational-access';
import { MedicationResolver } from '../src/medication/medication.resolver';
import { ShiftResolver } from '../src/shift/shift.resolver';
import { StatsController } from '../src/stats/stats.controller';
import { VisitResolver } from '../src/visit/visit.resolver';

function getRoles(target: object, methodName: string): string[] {
  return Reflect.getMetadata('roles', (target as any)[methodName]) ?? [];
}

function isLegacyOperationalSurface(target: object): boolean {
  return Reflect.getMetadata(LEGACY_OPERATIONAL_SURFACE_KEY, target.constructor) ?? false;
}

describe('CareBridge access hardening metadata', () => {
  it('keeps raw visit queries staff-only', () => {
    expect(getRoles(VisitResolver.prototype, 'visit')).toEqual(['admin', 'carer']);
    expect(getRoles(VisitResolver.prototype, 'visits')).toEqual(['admin', 'carer']);
  });

  it('keeps raw care log queries staff-only', () => {
    expect(getRoles(CareLogResolver.prototype, 'careLogs')).toEqual(['admin', 'carer']);
    expect(getRoles(CareLogResolver.prototype, 'monthlyCareSummary')).toEqual(['admin', 'carer']);
  });

  it('keeps medication records and administration operations staff-only', () => {
    expect(getRoles(MedicationResolver.prototype, 'listDueMeds')).toEqual(['admin', 'carer']);
    expect(getRoles(MedicationResolver.prototype, 'recordAdministration')).toEqual([
      'admin',
      'carer',
    ]);
    expect(getRoles(MedicationResolver.prototype, 'getTodaysMedicationsByClient')).toEqual([
      'admin',
      'carer',
    ]);
    expect(getRoles(MedicationResolver.prototype, 'medications')).toEqual(['admin', 'carer']);
    expect(getRoles(MedicationResolver.prototype, 'createMedication')).toEqual(['admin']);
    expect(getRoles(MedicationResolver.prototype, 'createPrescription')).toEqual(['admin']);
  });

  it('keeps care-planning internals staff-only', () => {
    expect(getRoles(CarePlanningResolver.prototype, 'assessments')).toEqual(['admin', 'carer']);
    expect(getRoles(CarePlanningResolver.prototype, 'carePlans')).toEqual(['admin', 'carer']);
    expect(getRoles(CarePlanningResolver.prototype, 'evidencePacks')).toEqual(['admin', 'carer']);
    expect(getRoles(CarePlanningResolver.prototype, 'evidenceSourceCandidates')).toEqual(['admin', 'carer']);
    expect(getRoles(CarePlanningResolver.prototype, 'createAssessment')).toEqual(['admin', 'carer']);
    expect(getRoles(CarePlanningResolver.prototype, 'createCarePlan')).toEqual(['admin', 'carer']);
    expect(getRoles(CarePlanningResolver.prototype, 'createEvidencePack')).toEqual(['admin', 'carer']);
  });

  it('keeps internal AI summary history staff-only', () => {
    expect(getRoles(AiSummaryResolver.prototype, 'listHistory')).toEqual([
      'admin',
      'manager',
      'carer',
    ]);
    expect(getRoles(AiSummaryResolver.prototype, 'currentWeekSummary')).toEqual([
      'admin',
      'manager',
      'carer',
    ]);
  });

  it('keeps raw client management outside external access', () => {
    expect(getRoles(ClientResolver.prototype, 'clients')).toEqual(['admin', 'carer']);
    expect(getRoles(ClientResolver.prototype, 'client')).toEqual(['admin', 'carer']);
  });

  it('keeps staff/admin reporting outside external access', () => {
    expect(getRoles(StatsController.prototype, 'today')).toEqual(['admin']);
    expect(getRoles(CarerResolver.prototype, 'carers')).toEqual(['admin']);
    expect(getRoles(ShiftResolver.prototype, 'shiftAnalytics')).toEqual(['admin']);
  });

  it('marks other staff-only operational resolvers as legacy operational surfaces', () => {
    expect(isLegacyOperationalSurface(MedicationResolver.prototype)).toBe(true);
    expect(isLegacyOperationalSurface(ShiftResolver.prototype)).toBe(true);
    expect(isLegacyOperationalSurface(CarerResolver.prototype)).toBe(true);
    expect(isLegacyOperationalSurface(CarePlanningResolver.prototype)).toBe(true);
  });

  it('has no raw medication audit resolver for family users', () => {
    expect((MedicationResolver.prototype as any).medicationAudit).toBeUndefined();
    expect((MedicationResolver.prototype as any).medicationAudits).toBeUndefined();
  });
});
