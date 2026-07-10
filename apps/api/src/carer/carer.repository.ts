import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "@oasis/db";
import { assertTenantIdForSensitiveWrite } from "../common/tenant/tenant-ownership";

@Injectable()
export class CarerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(organizationId: string): Promise<any[]> {
    return (this.prisma as any).carer.findMany({
      where: this.prisma.whereNotDeleted({
        is_active: true,
        organization_id: organizationId,
        organization_memberships: {
          some: {
            organization_id: organizationId,
            identity_provider: this.identityProvider(),
            auth_subject: { not: "" },
            role: { in: ["carer", "staff"] },
            status: "ACTIVE",
            revoked_at: null,
          },
        },
      }),
      orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
    });
  }

  private identityProvider(): string {
    return String(process.env.AUTH_IDENTITY_PROVIDER || "cognito")
      .trim()
      .toLowerCase();
  }

  async upsertById(input: {
    organization_id: string;
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    is_active: boolean;
  }) {
    const organizationId = assertTenantIdForSensitiveWrite(
      "Carer",
      input.organization_id,
    );
    // `id` is the Cognito sub.
    const existing = await this.prisma.carer.findUnique({
      where: { id: input.id },
      select: { id: true, organization_id: true },
    });

    if (existing && existing.organization_id !== organizationId) {
      throw new ForbiddenException(
        "Carer profile already belongs to another organization",
      );
    }

    const data = {
      organization_id: organizationId,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone ?? null,
      is_active: input.is_active,
      deleted_at: null,
    };

    if (!existing) {
      return this.prisma.carer.create({
        data: {
          id: input.id,
          ...data,
        },
      });
    }

    return this.prisma.carer.update({
      where: { id: input.id },
      data,
    });
  }
}
