import { ConfigService } from "@nestjs/config";
import { VisitCompletionProofKeyring } from "./visit-completion-proof-keyring";
import { VisitRepository } from "./visit.repository";

describe("VisitRepository tenant write safety", () => {
  function keyring() {
    return new VisitCompletionProofKeyring(
      new ConfigService({
        VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "test-v1",
        VISIT_COMPLETION_PROOF_ACTIVE_SECRET:
          "visit-completion-proof-test-secret-32-bytes-minimum",
      }),
    );
  }

  function createRepository() {
    const prisma = {
      whereNotDeleted: (where: Record<string, unknown>) => ({
        ...where,
        deleted_at: null,
      }),
      visit: {
        create: jest.fn(),
      },
      carer: {
        findFirst: jest.fn(),
      },
    } as any;

    return {
      prisma,
      repository: new VisitRepository(prisma, keyring()),
    };
  }

  it("rejects visit creation without tenant ownership", async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.create({
        carer: { connect: { id: "carer-1" } },
        client: { connect: { id: "client-1" } },
        scheduled_start: new Date("2026-05-01T09:00:00.000Z"),
        scheduled_end: new Date("2026-05-01T10:00:00.000Z"),
      } as any),
    ).rejects.toThrow("Organization context is required");

    expect(prisma.visit.create).not.toHaveBeenCalled();
  });

  it("requires an active non-revoked workforce membership before assignment", async () => {
    const { prisma, repository } = createRepository();
    prisma.carer.findFirst.mockResolvedValue({ id: "carer-1" });

    await expect(
      repository.findCarerInOrganization("carer-1", "org-1"),
    ).resolves.toBe(true);
    expect(prisma.carer.findFirst).toHaveBeenCalledWith({
      where: {
        id: "carer-1",
        organization_id: "org-1",
        is_active: true,
        deleted_at: null,
        organization_memberships: {
          some: {
            organization_id: "org-1",
            identity_provider: "clerk",
            auth_subject: { not: "" },
            role: { in: ["carer", "staff"] },
            status: "ACTIVE",
            revoked_at: null,
          },
        },
      },
      select: { id: true },
    });
  });

  it("checks the locked terminal visit before a guided task mutation", async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: "visit-1" }]),
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: "membership-1" }),
      },
      visitTask: {
        findFirst: jest.fn().mockResolvedValueOnce({ visit_id: "visit-1" }),
        update: jest.fn(),
      },
      visit: {
        findFirst: jest.fn().mockResolvedValue({
          id: "visit-1",
          organization_id: "org-1",
          carer_id: "carer-1",
          status: "COMPLETED",
          client: { organization_id: "org-1", deleted_at: null },
        }),
      },
    } as any;
    const prisma = {
      $transaction: jest.fn((operation) => operation(tx)),
    } as any;
    const repository = new VisitRepository(prisma, keyring());

    await expect(
      repository.writeGuidedTaskAtomically({
        taskId: "task-1",
        organizationId: "org-1",
        expectedCarerId: "carer-1",
        actor: {
          authSubject: "user-1",
          identityProvider: "clerk",
          membershipId: "membership-1",
        },
        write: { kind: "COMPLETE", notes: "late note" },
      }),
    ).resolves.toEqual({ status: "TERMINAL" });
    expect(tx.organizationMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          revoked_at: null,
          auth_subject: "user-1",
          carer_id: "carer-1",
        }),
      }),
    );
    expect(tx.visitTask.update).not.toHaveBeenCalled();
  });

  it("writes a narrow delete audit in the same transaction as soft deletion", async () => {
    const visit = {
      id: "visit-1",
      organization_id: "org-1",
      carer_id: "carer-1",
      status: "SCHEDULED",
      notes: "Sensitive visit note",
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: visit.id }]),
      visit: {
        findFirst: jest.fn().mockResolvedValue(visit),
        update: jest
          .fn()
          .mockResolvedValue({ ...visit, deleted_at: new Date() }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    } as any;
    const prisma = {
      $transaction: jest.fn((operation) => operation(tx)),
    } as any;
    const repository = new VisitRepository(prisma, keyring());

    await expect(
      repository.deleteAtomically({
        visitId: visit.id,
        organizationId: "org-1",
        actorAuthSubject: "admin-subject",
      }),
    ).resolves.toMatchObject({ status: "DELETED" });
    expect(tx.visit.update).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const auditData = tx.auditLog.create.mock.calls[0][0].data;
    expect(auditData).toMatchObject({
      organization_id: "org-1",
      user_id: "admin-subject",
      action: "VISIT_DELETED",
      resource_type: "Visit",
      resource_id: visit.id,
      old_values: { status: "SCHEDULED", deleted: false },
      new_values: { status: "SCHEDULED", deleted: true },
    });
    expect(JSON.stringify(auditData)).not.toContain(visit.notes);
  });
});
