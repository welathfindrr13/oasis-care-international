import { BaseHttpException } from '../../common/errors/base-http.exception';
import {
  EvidencePackStatusGQL,
  EvidenceSourceTypeGQL,
} from '../dto/care-planning.dto';
import { CarePlanningRepository } from '../care-planning.repository';
import { CarePlanningService } from '../care-planning.service';

describe('CarePlanningService', () => {
  let service: CarePlanningService;
  let repository: jest.Mocked<CarePlanningRepository>;

  beforeEach(() => {
    delete process.env.MEDICATION_EMAR_ENABLED;
    repository = {
      listAssessments: jest.fn(),
      createAssessment: jest.fn(),
      getAssessment: jest.fn(),
      completeAssessment: jest.fn(),
      listCarePlans: jest.fn(),
      createCarePlan: jest.fn(),
      getCarePlan: jest.fn(),
      approveCarePlan: jest.fn(),
      archiveCarePlan: jest.fn(),
      listEvidencePacks: jest.fn(),
      createEvidencePack: jest.fn(),
      listEvidenceSourceCandidates: jest.fn(),
      getEvidencePack: jest.fn(),
      recordEvidencePackExport: jest.fn(),
    } as unknown as jest.Mocked<CarePlanningRepository>;
    service = new CarePlanningService(repository);
  });

  it('denies staff-read operations for non staff roles', async () => {
    await expect(
      service.listAssessments('client-1', 10, { role: 'user', organizationId: 'org-1' }),
    ).rejects.toBeInstanceOf(BaseHttpException);
    expect(repository.listAssessments).not.toHaveBeenCalled();
  });

  it('denies family role from write operations', async () => {
    await expect(
      service.completeAssessment(
        { assessmentId: 'assessment-1' },
        { role: 'family', organizationId: 'org-1' },
      ),
    ).rejects.toBeInstanceOf(BaseHttpException);
    expect(repository.completeAssessment).not.toHaveBeenCalled();
  });

  it('completes assessment for staff and defaults assessorId from viewer', async () => {
    repository.completeAssessment.mockResolvedValue({
      id: 'assessment-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      status: 'COMPLETED',
      source: 'MANUAL',
      title: 'Mobility assessment',
      findings: {},
      risk_flags: null,
      recommended_actions: null,
      assessor_id: 'staff-1',
      completed_at: new Date('2026-05-07T10:00:00.000Z'),
      review_due_at: null,
      visit_id: null,
      summary: null,
      created_at: new Date('2026-05-01T10:00:00.000Z'),
      updated_at: new Date('2026-05-07T10:00:00.000Z'),
    });

    await service.completeAssessment(
      { assessmentId: 'assessment-1' },
      { role: 'admin', organizationId: 'org-1', userId: 'staff-1' },
    );

    expect(repository.completeAssessment).toHaveBeenCalledWith('org-1', {
      assessmentId: 'assessment-1',
      assessorId: 'staff-1',
    });
  });

  it('approves care plan and triggers supersede flow in repository', async () => {
    repository.approveCarePlan.mockResolvedValue({
      id: 'plan-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      assessment_id: 'assessment-1',
      status: 'ACTIVE',
      version: 2,
      title: 'Reablement plan',
      goals: {},
      interventions: {},
      safety_notes: null,
      effective_from: new Date('2026-05-07T10:00:00.000Z'),
      effective_to: null,
      review_due_at: null,
      authored_by_id: 'staff-2',
      approved_by_id: 'admin-1',
      approved_at: new Date('2026-05-07T10:00:00.000Z'),
      created_at: new Date('2026-05-01T10:00:00.000Z'),
      updated_at: new Date('2026-05-07T10:00:00.000Z'),
    });

    await service.approveCarePlan(
      { carePlanId: 'plan-1' },
      { role: 'admin', organizationId: 'org-1', userId: 'admin-1' },
    );

    expect(repository.approveCarePlan).toHaveBeenCalledWith('org-1', {
      carePlanId: 'plan-1',
      approvedById: 'admin-1',
    });
  });

  it('records evidence pack export for staff and defaults actor from viewer', async () => {
    repository.getEvidencePack.mockResolvedValue({
      id: 'pack-1',
      source_refs: {},
      items: [],
    } as any);
    repository.recordEvidencePackExport.mockResolvedValue({
      id: 'pack-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      care_plan_id: 'plan-1',
      status: 'COMPILED',
      kind: 'INSPECTION',
      period_start: new Date('2026-05-01T00:00:00.000Z'),
      period_end: new Date('2026-05-07T00:00:00.000Z'),
      summary: null,
      source_refs: {},
      generated_by: 'system',
      generated_at: new Date('2026-05-07T10:00:00.000Z'),
      published_at: null,
      items: [],
      created_at: new Date('2026-05-07T10:00:00.000Z'),
      updated_at: new Date('2026-05-07T10:00:00.000Z'),
    });

    await service.recordEvidencePackExport(
      'pack-1',
      { role: 'admin', organizationId: 'org-1', userId: 'admin-1' },
    );

    expect(repository.recordEvidencePackExport).toHaveBeenCalledWith('org-1', 'pack-1', 'admin-1');
  });

  it('rejects explicit medication candidates before repository access', async () => {
    await expect(
      service.evidenceSourceCandidates(
        {
          clientId: 'client-1',
          periodStart: new Date('2026-05-01T00:00:00.000Z'),
          periodEnd: new Date('2026-05-07T23:59:59.000Z'),
          sourceTypes: [EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION],
        },
        { role: 'admin', organizationId: 'org-1', userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'FEATURE_NOT_ENABLED' },
    });
    expect(repository.listEvidenceSourceCandidates).not.toHaveBeenCalled();
  });

  it('rejects medication-derived evidence packs before creation', async () => {
    await expect(
      service.createEvidencePack(
        {
          clientId: 'client-1',
          status: EvidencePackStatusGQL.DRAFT,
          periodStart: new Date('2026-05-01T00:00:00.000Z'),
          periodEnd: new Date('2026-05-07T23:59:59.000Z'),
          items: [
            {
              sourceType: EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION,
              sourceId: 'med-1',
              headline: 'Medication outcome',
            },
          ],
        },
        { role: 'admin', organizationId: 'org-1', userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'FEATURE_NOT_ENABLED' },
    });
    expect(repository.createEvidencePack).not.toHaveBeenCalled();
  });

  it('refuses a medication-derived historical pack before recording export', async () => {
    repository.getEvidencePack.mockResolvedValue({
      id: 'pack-medication',
      source_refs: { sourceType: 'MEDICATION_ADMINISTRATION', id: 'med-1' },
      items: [],
    } as any);

    await expect(
      service.recordEvidencePackExport('pack-medication', {
        role: 'admin',
        organizationId: 'org-1',
        userId: 'admin-1',
      }),
    ).rejects.toMatchObject({
      response: { code: 'FEATURE_NOT_ENABLED' },
    });
    expect(repository.recordEvidencePackExport).not.toHaveBeenCalled();
  });

  it('lists evidence source candidates for clinical staff', async () => {
    repository.listEvidenceSourceCandidates.mockResolvedValue([
      {
        id: 'visit-1',
        sourceType: EvidenceSourceTypeGQL.VISIT,
        title: 'Visit completed',
        subtitle: 'Scheduled 09:00 to 10:00',
        occurredAt: new Date('2026-05-07T09:00:00.000Z'),
        createdBy: 'Asha Patel',
        status: 'COMPLETED',
        previewText: 'Morning personal care visit',
      },
    ]);

    const result = await service.evidenceSourceCandidates(
      {
        clientId: 'client-1',
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-07T23:59:59.000Z'),
        sourceTypes: [EvidenceSourceTypeGQL.VISIT],
        take: 25,
      },
      { role: 'admin', organizationId: 'org-1', userId: 'admin-1' },
    );

    expect(result).toHaveLength(1);
    expect(repository.listEvidenceSourceCandidates).toHaveBeenCalledWith('org-1', {
      clientId: 'client-1',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-07T23:59:59.000Z'),
      sourceTypes: [EvidenceSourceTypeGQL.VISIT],
      take: 25,
    });
  });

  it('denies evidence source candidates for carer, family, and user roles', async () => {
    await expect(
      service.evidenceSourceCandidates(
        {
          clientId: 'client-1',
          periodStart: new Date('2026-05-01T00:00:00.000Z'),
          periodEnd: new Date('2026-05-07T23:59:59.000Z'),
        },
        { role: 'carer', organizationId: 'org-1' },
      ),
    ).rejects.toBeInstanceOf(BaseHttpException);

    await expect(
      service.evidenceSourceCandidates(
        {
          clientId: 'client-1',
          periodStart: new Date('2026-05-01T00:00:00.000Z'),
          periodEnd: new Date('2026-05-07T23:59:59.000Z'),
        },
        { role: 'family', organizationId: 'org-1' },
      ),
    ).rejects.toBeInstanceOf(BaseHttpException);

    await expect(
      service.evidenceSourceCandidates(
        {
          clientId: 'client-1',
          periodStart: new Date('2026-05-01T00:00:00.000Z'),
          periodEnd: new Date('2026-05-07T23:59:59.000Z'),
        },
        { role: 'user', organizationId: 'org-1' },
      ),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(repository.listEvidenceSourceCandidates).not.toHaveBeenCalled();
  });

  it('requires organization context for evidence source candidates', async () => {
    await expect(
      service.evidenceSourceCandidates(
        {
          clientId: 'client-1',
          periodStart: new Date('2026-05-01T00:00:00.000Z'),
          periodEnd: new Date('2026-05-07T23:59:59.000Z'),
        },
        { role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(repository.listEvidenceSourceCandidates).not.toHaveBeenCalled();
  });

  it('rejects unsupported evidence source candidate types before querying', async () => {
    await expect(
      service.evidenceSourceCandidates(
        {
          clientId: 'client-1',
          periodStart: new Date('2026-05-01T00:00:00.000Z'),
          periodEnd: new Date('2026-05-07T23:59:59.000Z'),
          sourceTypes: [EvidenceSourceTypeGQL.CARE_PLAN],
        },
        { role: 'admin', organizationId: 'org-1' },
      ),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(repository.listEvidenceSourceCandidates).not.toHaveBeenCalled();
  });
});
