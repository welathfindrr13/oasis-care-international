import { SarService } from './sar.service';
import { ConsentService } from './consent.service';
import { ErasureService } from './erasure.service';

describe('GDPR service tenant isolation', () => {
  function createPrisma() {
    return {
      client: { findFirst: jest.fn(), update: jest.fn() },
      carer: { findFirst: jest.fn(), update: jest.fn() },
      visit: { findMany: jest.fn(), updateMany: jest.fn() },
      visitTask: { deleteMany: jest.fn() },
      prescription: { findMany: jest.fn(), deleteMany: jest.fn() },
      healthSummary: { findMany: jest.fn(), deleteMany: jest.fn() },
      consentRecord: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      erasureQueue: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      logEmbedding: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    } as any;
  }

  it('scopes consent writes by organisation', async () => {
    const prisma = createPrisma();
    const service = new ConsentService(prisma);
    prisma.consentRecord.findFirst.mockResolvedValue(null);
    prisma.consentRecord.create.mockResolvedValue({
      id: 'consent-1',
      organization_id: 'org-1',
      user_id: 'client-1',
      consent_type: 'family_access',
      purpose: 'CareBridge',
      granted: true,
      granted_at: new Date('2026-05-01T00:00:00.000Z'),
      withdrawn_at: null,
      legal_basis: 'consent',
      metadata: {},
    });

    await service.grantConsent({
      organizationId: 'org-1',
      userId: 'client-1',
      consentType: 'family_access',
      purpose: 'CareBridge',
      legalBasis: 'consent',
    });

    expect(prisma.consentRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          user_id: 'client-1',
        }),
      }),
    );
    expect(prisma.consentRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization_id: 'org-1',
        }),
      }),
    );
  });

  it('scopes SAR exports by organisation across profile, care records, consent, and audit logs', async () => {
    const prisma = createPrisma();
    const service = new SarService(prisma);
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.carer.findFirst.mockResolvedValue(null);
    prisma.visit.findMany.mockResolvedValue([]);
    prisma.prescription.findMany.mockResolvedValue([]);
    prisma.healthSummary.findMany.mockResolvedValue([]);
    prisma.consentRecord.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.generateSubjectAccessReport('org-1', 'client-1');

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-1', organization_id: 'org-1' },
    });
    expect(prisma.visit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
        }),
      }),
    );
    expect(prisma.consentRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organization_id: 'org-1', user_id: 'client-1' },
      }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organization_id: 'org-1', user_id: 'client-1' },
      }),
    );
  });

  it('scopes erasure queue lookup and processing by organisation', async () => {
    const prisma = createPrisma();
    const service = new ErasureService(prisma);
    prisma.erasureQueue.findFirst.mockResolvedValue(null);
    prisma.erasureQueue.create.mockResolvedValue({
      id: 'erase-1',
      organization_id: 'org-1',
      user_id: 'client-1',
      request_type: 'full',
      status: 'pending',
      requested_at: new Date('2026-05-01T00:00:00.000Z'),
      scheduled_for: new Date('2026-05-31T00:00:00.000Z'),
      completed_at: null,
    });

    await service.enqueueDataErasure('org-1', 'client-1', 'full', 'subject request');

    expect(prisma.erasureQueue.findFirst).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        user_id: 'client-1',
        request_type: 'full',
        status: 'pending',
      },
    });
    expect(prisma.erasureQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization_id: 'org-1',
          user_id: 'client-1',
        }),
      }),
    );
  });
});
