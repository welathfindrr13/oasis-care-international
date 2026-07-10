import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "@oasis/db";

export type VerifiedCarerPrincipal = {
  organizationMembershipId?: string | null;
  organizationId?: string | null;
  authSubject?: string | null;
};

export type ResolvedCarerIdentity = {
  carerId: string;
  authSubject: string;
};

type MembershipCarerRow = {
  id: string;
  organization_id: string;
  auth_subject: string;
  role: string;
  status: string;
  carer_id: string | null;
  carer: {
    id: string;
    organization_id: string;
    is_active: boolean;
    deleted_at: Date | null;
  } | null;
};

const ALLOWED_CARER_MEMBERSHIP_ROLES = new Set(["carer", "staff"]);
const CARER_LINK_REQUIRED_MESSAGE = "Active carer membership link is required";

@Injectable()
export class CarerAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireCarerIdentity(
    principal: VerifiedCarerPrincipal,
  ): Promise<ResolvedCarerIdentity> {
    const organizationMembershipId = this.nonEmpty(
      principal.organizationMembershipId,
    );
    const organizationId = this.nonEmpty(principal.organizationId);
    const authSubject = this.nonEmpty(principal.authSubject);

    if (!organizationMembershipId || !organizationId || !authSubject) {
      this.deny();
    }

    const memberships = (await this.prisma.organizationMembership.findMany({
      where: {
        id: organizationMembershipId,
        organization_id: organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        organization_id: true,
        auth_subject: true,
        role: true,
        status: true,
        carer_id: true,
        carer: {
          select: {
            id: true,
            organization_id: true,
            is_active: true,
            deleted_at: true,
          },
        },
      },
      take: 2,
    } as any)) as unknown as MembershipCarerRow[];

    if (memberships.length !== 1) {
      this.deny();
    }

    const membership = memberships[0];
    const rawRole = membership.role.trim().toLowerCase();
    const carer = membership.carer;

    if (
      membership.status !== "ACTIVE" ||
      membership.organization_id !== organizationId ||
      membership.auth_subject !== authSubject ||
      !ALLOWED_CARER_MEMBERSHIP_ROLES.has(rawRole) ||
      !membership.carer_id ||
      !carer ||
      carer.id !== membership.carer_id ||
      carer.organization_id !== organizationId ||
      !carer.is_active ||
      carer.deleted_at !== null
    ) {
      this.deny();
    }

    return {
      carerId: carer.id,
      authSubject,
    };
  }

  private nonEmpty(value?: string | null): string | null {
    const normalized = (value || "").trim();
    return normalized.length > 0 ? normalized : null;
  }

  private deny(): never {
    throw new ForbiddenException(CARER_LINK_REQUIRED_MESSAGE);
  }
}
