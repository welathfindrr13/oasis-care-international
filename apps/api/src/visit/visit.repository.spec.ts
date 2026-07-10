import { VisitRepository } from "./visit.repository";

describe("VisitRepository tenant write safety", () => {
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
      repository: new VisitRepository(prisma),
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
            identity_provider: "cognito",
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
});
