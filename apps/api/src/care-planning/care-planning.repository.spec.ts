import { BaseHttpException } from '../common/errors/base-http.exception';
import { EvidenceSourceTypeGQL } from './dto/care-planning.dto';
import { CarePlanningRepository } from './care-planning.repository';

describe('CarePlanningRepository', () => {
  function createRepository() {
    const prisma = {
      client: {
        findFirst: jest.fn(),
      },
      visit: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      careLog: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      medicationAdministration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      assessment: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      carePlan: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      concern: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      evidencePack: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    return {
      prisma,
      repository: new CarePlanningRepository(prisma),
    };
  }

  it('rejects assessment creation when the person is outside the organisation scope', async () => {
    const { prisma, repository } = createRepository();
    prisma.client.findFirst.mockResolvedValue(null);

    await expect(
      repository.createAssessment('org-1', {
        clientId: 'client-from-org-2',
        status: 'DRAFT' as any,
        source: 'MANUAL' as any,
        title: 'Initial assessment',
        findings: {},
      }),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });

  it('rejects assessment creation before lookup when tenant ownership is missing', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.createAssessment('   ', {
        clientId: 'client-1',
        status: 'DRAFT' as any,
        source: 'MANUAL' as any,
        title: 'Initial assessment',
        findings: {},
      }),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });

  it('rejects care plan creation when the source assessment is not for the same organisation and person', async () => {
    const { prisma, repository } = createRepository();
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
    prisma.assessment.findFirst.mockResolvedValue(null);

    await expect(
      repository.createCarePlan('org-1', {
        clientId: 'client-1',
        assessmentId: 'assessment-from-org-2',
        status: 'DRAFT' as any,
        title: 'Care plan',
        goals: {},
        interventions: {},
      }),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(prisma.carePlan.create).not.toHaveBeenCalled();
  });

  it('rejects care plan creation before lookup when tenant ownership is missing', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.createCarePlan('', {
        clientId: 'client-1',
        status: 'DRAFT' as any,
        title: 'Care plan',
        goals: {},
        interventions: {},
      }),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.carePlan.create).not.toHaveBeenCalled();
  });

  it('rejects evidence pack creation when an evidence source is outside the organisation scope', async () => {
    const { prisma, repository } = createRepository();
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
    prisma.carePlan.findFirst.mockResolvedValue({ id: 'plan-1' });
    prisma.visit.findFirst.mockResolvedValue(null);

    await expect(
      repository.createEvidencePack('org-1', {
        clientId: 'client-1',
        carePlanId: 'plan-1',
        status: 'DRAFT' as any,
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-07T00:00:00.000Z'),
        items: [
          {
            sourceType: 'VISIT' as any,
            sourceId: 'visit-from-org-2',
            headline: 'Visit evidence',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(prisma.evidencePack.create).not.toHaveBeenCalled();
  });

  it('writes explicit UTC calendar keys to date-only fields in GMT and BST seasons', async () => {
    const { prisma, repository } = createRepository();
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
    prisma.evidencePack.create.mockResolvedValue({ id: 'pack-1' });

    await repository.createEvidencePack('org-1', {
      clientId: 'client-1',
      status: 'DRAFT' as any,
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-07T00:00:00.000Z'),
    });
    await repository.createEvidencePack('org-1', {
      clientId: 'client-1',
      status: 'DRAFT' as any,
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-01-07T00:00:00.000Z'),
    });

    expect(prisma.evidencePack.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          period_start: new Date('2026-05-01T00:00:00.000Z'),
          period_end: new Date('2026-05-07T00:00:00.000Z'),
        }),
      }),
    );
    expect(prisma.evidencePack.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          period_start: new Date('2026-01-01T00:00:00.000Z'),
          period_end: new Date('2026-01-07T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('rejects evidence pack creation before lookup when tenant ownership is missing', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.createEvidencePack(' ', {
        clientId: 'client-1',
        status: 'DRAFT' as any,
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-07T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.evidencePack.create).not.toHaveBeenCalled();
  });

  it('returns mapped evidence source candidates for supported operational records sorted newest first', async () => {
    const { prisma, repository } = createRepository();
    const periodStart = new Date('2026-05-01T00:00:00.000Z');
    const periodEnd = new Date('2026-05-07T23:59:59.000Z');

    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
    prisma.visit.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        scheduled_start: new Date('2026-05-02T09:00:00.000Z'),
        scheduled_end: new Date('2026-05-02T10:00:00.000Z'),
        actual_start: new Date('2026-05-02T09:05:00.000Z'),
        actual_end: new Date('2026-05-02T09:55:00.000Z'),
        status: 'COMPLETED',
        notes: 'Morning support completed.',
        carer: { first_name: 'Asha', last_name: 'Patel' },
      },
    ]);
    prisma.careLog.findMany.mockResolvedValue([
      {
        id: 'care-log-1',
        occurred_at: new Date('2026-05-03T11:00:00.000Z'),
        category: 'MOOD',
        notes: 'Bright and settled after breakfast.',
        escalated: false,
        escalated_to: null,
        carer: { first_name: 'Ben', last_name: 'Miles' },
      },
    ]);
    prisma.medicationAdministration.findMany.mockResolvedValue([
      {
        id: 'med-admin-1',
        scheduled_time: new Date('2026-05-04T08:00:00.000Z'),
        administered_time: null,
        status: 'REFUSED',
        notes: 'Medication support refused and manager notified.',
        administered_by: 'carer-2',
        visit: { carer: { first_name: 'Cara', last_name: 'Jones' } },
      },
    ]);
    prisma.concern.findMany.mockResolvedValue([
      {
        id: 'concern-1',
        created_at: new Date('2026-05-05T12:00:00.000Z'),
        resolved_at: null,
        title: 'Family requested update',
        description: 'Daughter asked for a call about lunch support.',
        severity: 'MEDIUM',
        status: 'OPEN',
        category: 'COMMUNICATION',
        assigned_to_user_id: 'admin-1',
      },
    ]);

    const result = await repository.listEvidenceSourceCandidates('org-1', {
      clientId: 'client-1',
      periodStart,
      periodEnd,
      sourceTypes: [
        EvidenceSourceTypeGQL.VISIT,
        EvidenceSourceTypeGQL.CARE_LOG,
        EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION,
        EvidenceSourceTypeGQL.CONCERN,
      ],
      take: 10,
    });

    expect(result.map((candidate) => `${candidate.sourceType}:${candidate.id}`)).toEqual([
      'CONCERN:concern-1',
      'MEDICATION_ADMINISTRATION:med-admin-1',
      'CARE_LOG:care-log-1',
      'VISIT:visit-1',
    ]);
    expect(result[0]).toMatchObject({
      title: 'Concern case: Family requested update',
      status: 'OPEN',
      previewText: 'Daughter asked for a call about lunch support.',
    });
    expect(result[1]).toMatchObject({
      title: 'Medication support: refused',
      subtitle: 'Medication support status REFUSED',
      createdBy: 'Cara Jones',
    });
    expect(result[2]).toMatchObject({
      title: 'Care note: mood',
      createdBy: 'Ben Miles',
    });
    expect(result[3]).toMatchObject({
      title: 'Care visit: completed',
      createdBy: 'Asha Patel',
    });
  });

  it('scopes evidence source candidate queries to organisation, person, date range, and active records', async () => {
    const { prisma, repository } = createRepository();
    const periodStart = new Date('2026-05-01T00:00:00.000Z');
    const periodEnd = new Date('2026-05-07T23:59:59.000Z');

    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
    prisma.visit.findMany.mockResolvedValue([]);
    prisma.careLog.findMany.mockResolvedValue([]);
    prisma.medicationAdministration.findMany.mockResolvedValue([]);
    prisma.concern.findMany.mockResolvedValue([]);

    await repository.listEvidenceSourceCandidates('org-1', {
      clientId: 'client-1',
      periodStart,
      periodEnd,
      sourceTypes: [
        EvidenceSourceTypeGQL.VISIT,
        EvidenceSourceTypeGQL.CARE_LOG,
        EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION,
        EvidenceSourceTypeGQL.CONCERN,
      ],
      take: 2,
    });

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-1', organization_id: 'org-1', deleted_at: null },
      select: { id: true },
    });
    expect(prisma.visit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          client_id: 'client-1',
          deleted_at: null,
          scheduled_start: { gte: periodStart, lte: periodEnd },
        }),
      }),
    );
    expect(prisma.careLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          client_id: 'client-1',
          deleted_at: null,
          occurred_at: { gte: periodStart, lte: periodEnd },
        }),
      }),
    );
    expect(prisma.medicationAdministration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deleted_at: null,
          scheduled_time: { gte: periodStart, lte: periodEnd },
        }),
      }),
    );
    expect(prisma.concern.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          client_id: 'client-1',
          created_at: { gte: periodStart, lte: periodEnd },
        }),
      }),
    );
  });

  it('rejects unsupported evidence source candidate types', async () => {
    const { prisma, repository } = createRepository();
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });

    await expect(
      repository.listEvidenceSourceCandidates('org-1', {
        clientId: 'client-1',
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-07T23:59:59.000Z'),
        sourceTypes: [EvidenceSourceTypeGQL.ASSESSMENT],
        take: 10,
      }),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(prisma.visit.findMany).not.toHaveBeenCalled();
    expect(prisma.careLog.findMany).not.toHaveBeenCalled();
  });

  it('caps evidence source candidates after sorting', async () => {
    const { prisma, repository } = createRepository();
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
    prisma.visit.findMany.mockResolvedValue([
      {
        id: 'visit-old',
        scheduled_start: new Date('2026-05-01T09:00:00.000Z'),
        scheduled_end: new Date('2026-05-01T10:00:00.000Z'),
        actual_start: null,
        actual_end: null,
        status: 'SCHEDULED',
        notes: null,
        carer: null,
      },
      {
        id: 'visit-new',
        scheduled_start: new Date('2026-05-07T09:00:00.000Z'),
        scheduled_end: new Date('2026-05-07T10:00:00.000Z'),
        actual_start: null,
        actual_end: null,
        status: 'SCHEDULED',
        notes: null,
        carer: null,
      },
    ]);

    const result = await repository.listEvidenceSourceCandidates('org-1', {
      clientId: 'client-1',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-07T23:59:59.000Z'),
      sourceTypes: [EvidenceSourceTypeGQL.VISIT],
      take: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('visit-new');
  });
});
