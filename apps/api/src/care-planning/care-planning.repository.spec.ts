import { BaseHttpException } from '../common/errors/base-http.exception';
import { CarePlanningRepository } from './care-planning.repository';

describe('CarePlanningRepository', () => {
  function createRepository() {
    const prisma = {
      client: {
        findFirst: jest.fn(),
      },
      visit: {
        findFirst: jest.fn(),
      },
      careLog: {
        findFirst: jest.fn(),
      },
      medicationAdministration: {
        findFirst: jest.fn(),
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
});
