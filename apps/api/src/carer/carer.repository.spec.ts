import { CarerRepository } from "./carer.repository";

describe("CarerRepository assignment directory", () => {
  it("lists only active profiles with a valid linked workforce membership", async () => {
    const prisma = {
      whereNotDeleted: (where: Record<string, unknown>) => ({
        ...where,
        deleted_at: null,
      }),
      carer: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const repository = new CarerRepository(prisma);

    await repository.findMany("org-1");

    expect(prisma.carer.findMany).toHaveBeenCalledWith({
      where: {
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
      orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
    });
  });
});
