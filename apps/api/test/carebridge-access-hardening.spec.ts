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
import { CarebridgeResolver } from '../src/carebridge/carebridge.resolver';
import { REQUIRED_ACCESS_CAPABILITIES } from '../src/auth/access-capability';

function getRoles(target: object, methodName: string): string[] {
  return Reflect.getMetadata('roles', (target as any)[methodName]) ?? [];
}

function isLegacyOperationalSurface(target: object): boolean {
  return Reflect.getMetadata(LEGACY_OPERATIONAL_SURFACE_KEY, target.constructor) ?? false;
}

function getCapabilities(target: object): string[] {
  return Reflect.getMetadata(REQUIRED_ACCESS_CAPABILITIES, target.constructor) ?? [];
}

function getMethodCapabilities(target: object, methodName: string): string[] {
  return Reflect.getMetadata(
    REQUIRED_ACCESS_CAPABILITIES,
    (target as any)[methodName],
  ) ?? [];
}

describe('CareBridge access hardening metadata', () => {
  it('keeps raw visit queries staff-only', () => {
    expect(getRoles(VisitResolver.prototype, 'visit')).toEqual(['admin', 'carer']);
    expect(getRoles(VisitResolver.prototype, 'visits')).toEqual(['admin', 'carer']);
  });

  it('reserves frontline care writes for the frontline execution capability', () => {
    for (const method of [
      'completeVisitTask',
      'startVisit',
      'recordVisitTaskOutcome',
      'submitVisitCareNote',
      'completeVisit',
    ]) {
      expect(getMethodCapabilities(VisitResolver.prototype, method)).toEqual([
        'FRONTLINE_VISIT_EXECUTE',
      ]);
    }
    expect(
      getMethodCapabilities(CareLogResolver.prototype, 'createCareLog'),
    ).toEqual(['FRONTLINE_VISIT_EXECUTE']);
    expect(
      getMethodCapabilities(MedicationResolver.prototype, 'recordAdministration'),
    ).toEqual(['FRONTLINE_VISIT_EXECUTE']);
  });

  it('keeps raw care log queries staff-only', () => {
    expect(getRoles(CareLogResolver.prototype, 'careLogs')).toEqual(['admin', 'carer']);
    expect(getRoles(CareLogResolver.prototype, 'monthlyCareSummary')).toEqual(['admin', 'carer']);
  });

  it('keeps medication records and administration operations staff-only', () => {
    expect(getRoles(MedicationResolver.prototype, 'listDueMeds')).toEqual(['admin', 'carer']);
    expect(getRoles(MedicationResolver.prototype, 'getTodaysMedicationsByClient')).toEqual([
      'admin',
      'carer',
    ]);
    expect(getRoles(MedicationResolver.prototype, 'medications')).toEqual(['admin', 'carer']);
    expect(getRoles(MedicationResolver.prototype, 'createMedication')).toEqual(['admin']);
    expect(getRoles(MedicationResolver.prototype, 'createPrescription')).toEqual(['admin']);
  });

  it('keeps care-planning internals admin-only', () => {
    expect(getRoles(CarePlanningResolver.prototype, 'assessments')).toEqual(['admin']);
    expect(getRoles(CarePlanningResolver.prototype, 'carePlans')).toEqual(['admin']);
    expect(getRoles(CarePlanningResolver.prototype, 'evidencePacks')).toEqual(['admin']);
    expect(getRoles(CarePlanningResolver.prototype, 'evidenceSourceCandidates')).toEqual(['admin']);
    expect(getRoles(CarePlanningResolver.prototype, 'createAssessment')).toEqual(['admin']);
    expect(getRoles(CarePlanningResolver.prototype, 'createCarePlan')).toEqual(['admin']);
    expect(getRoles(CarePlanningResolver.prototype, 'createEvidencePack')).toEqual(['admin']);
  });

  it('keeps internal AI summary history behind the authoritative review capability', () => {
    for (const method of [
      'listPendingSummaries',
      'listHistory',
      'currentWeekSummary',
      'approveSummary',
      'isAiSummaryEnabledForClientOrganization',
    ]) {
      expect(getMethodCapabilities(AiSummaryResolver.prototype, method)).toEqual(['AI_SUMMARY_REVIEW']);
    }
    expect(getMethodCapabilities(AiSummaryResolver.prototype, 'generateSummary')).toEqual(['AI_SUMMARY_GENERATE']);
    expect(getMethodCapabilities(AiSummaryResolver.prototype, 'setAiSummaryEnabledForClientOrganization')).toEqual(['AI_SUMMARY_CONFIGURE']);
  });

  it('keeps raw client management outside external access', () => {
    expect(getRoles(ClientResolver.prototype, 'clients')).toEqual(['admin', 'carer']);
    expect(getRoles(ClientResolver.prototype, 'client')).toEqual(['admin', 'carer']);
  });

  it('keeps staff/admin reporting outside external access', () => {
    expect(getRoles(StatsController.prototype, 'today')).toEqual(['admin']);
    expect(getRoles(CarerResolver.prototype, 'carers')).toEqual(['admin']);
    expect(getMethodCapabilities(ShiftResolver.prototype, 'shiftAnalytics')).toEqual(['WORKFORCE_MANAGE']);
  });

  it('separates frontline shift viewing and execution from workforce reporting', () => {
    for (const method of ['myActiveShift', 'myRecentShifts']) {
      expect(getMethodCapabilities(ShiftResolver.prototype, method)).toEqual(['FRONTLINE_SHIFT_VIEW']);
    }
    for (const method of ['clockIn', 'clockOut']) {
      expect(getMethodCapabilities(ShiftResolver.prototype, method)).toEqual(['FRONTLINE_SHIFT_EXECUTE']);
    }
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

  it('separates staff CareBridge operations from family-safe operations', () => {
    expect(getRoles(CarebridgeResolver.prototype, 'careRooms')).toEqual(['admin']);
    expect(getRoles(CarebridgeResolver.prototype, 'careRoom')).toEqual(['admin']);
    expect(getRoles(CarebridgeResolver.prototype, 'verifiedVisitStories')).toEqual(['admin']);
    expect(getRoles(CarebridgeResolver.prototype, 'raiseCarebridgeConcern')).toEqual(['admin']);
    expect(getRoles(CarebridgeResolver.prototype, 'familyCareRooms')).toEqual(['user']);
    expect(getRoles(CarebridgeResolver.prototype, 'familyCareRoom')).toEqual(['user']);
    expect(getRoles(CarebridgeResolver.prototype, 'familyVerifiedVisitStories')).toEqual(['user']);
    expect(getRoles(CarebridgeResolver.prototype, 'familyCareRoomConcerns')).toEqual(['user']);
    expect(getRoles(CarebridgeResolver.prototype, 'raiseFamilyCarebridgeConcern')).toEqual(['user']);
  });
});
