import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { randomUUID } from 'node:crypto';
import { CarerDTO } from './dto/carer.dto';
import { EligibleCarerMembershipDTO, LinkedCarerDTO } from './dto/carer-membership.dto';
import { CreateLinkedCarerInput } from './dto/create-linked-carer.input';

const ALLOWED_WORKFORCE_ROLES = ['carer', 'staff'] as const;
const ADMIN_MEMBERSHIP_REQUIRED = 'Verified admin organization membership is required';
const MEMBERSHIP_NOT_ELIGIBLE = 'Selected workforce membership is no longer eligible';

type VerifiedAdminPrincipal = {
  organizationId?: string | null;
  organizationMembershipId?: string | null;
  authSubject?: string | null;
};

type TransactionClient = {
  organizationMembership: {
    findFirst(args: unknown): Promise<any>;
    findMany(args: unknown): Promise<any[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  carer: {
    create(args: unknown): Promise<any>;
  };
  auditLog: {
    create(args: unknown): Promise<any>;
  };
};

@Injectable()
export class CarerMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async listEligibleMemberships(
    principal: VerifiedAdminPrincipal,
  ): Promise<EligibleCarerMembershipDTO[]> {
    const organizationId = this.requirePrincipalValue(principal.organizationId);
    const adminMembershipId = this.requirePrincipalValue(principal.organizationMembershipId);
    const actorSubject = this.requirePrincipalValue(principal.authSubject);

    await this.requireVerifiedAdmin(this.prisma as unknown as TransactionClient, {
      organizationId,
      adminMembershipId,
      actorSubject,
    });

    const memberships = await (this.prisma as any).organizationMembership.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        role: { in: [...ALLOWED_WORKFORCE_ROLES] },
        carer_id: null,
      },
      select: {
        id: true,
        identity_provider: true,
        role: true,
        normalized_email: true,
      },
      orderBy: [{ normalized_email: 'asc' }, { created_at: 'asc' }],
    });

    return memberships.map((membership: any) => ({
      id: membership.id,
      identityProvider: membership.identity_provider,
      role: membership.role,
      loginEmail: membership.normalized_email,
    }));
  }

  async createAndLinkCarer(
    input: CreateLinkedCarerInput,
    principal: VerifiedAdminPrincipal,
  ): Promise<LinkedCarerDTO> {
    const organizationId = this.requirePrincipalValue(principal.organizationId);
    const adminMembershipId = this.requirePrincipalValue(principal.organizationMembershipId);
    const actorSubject = this.requirePrincipalValue(principal.authSubject);
    const membershipId = this.requireInputValue(input.membershipId);
    const profile = this.normalizeProfile(input);

    try {
      return await (this.prisma as any).$transaction(async (tx: TransactionClient) => {
        await this.requireVerifiedAdmin(tx, { organizationId, adminMembershipId, actorSubject });

        const membership = await tx.organizationMembership.findFirst({
          where: {
            id: membershipId,
            organization_id: organizationId,
          },
          select: {
            id: true,
            role: true,
            status: true,
            carer_id: true,
          },
        });

        if (!membership) {
          throw new ForbiddenException(MEMBERSHIP_NOT_ELIGIBLE);
        }

        if (!this.isEligibleMembership(membership)) {
          throw new ConflictException(MEMBERSHIP_NOT_ELIGIBLE);
        }

        const carerId = randomUUID();
        const carer = await tx.carer.create({
          data: {
            id: carerId,
            organization_id: organizationId,
            first_name: profile.firstName,
            last_name: profile.lastName,
            email: profile.email,
            phone: profile.phone,
            is_active: true,
          },
        });

        const linkResult = await tx.organizationMembership.updateMany({
          where: {
            id: membershipId,
            organization_id: organizationId,
            status: 'ACTIVE',
            role: { in: [...ALLOWED_WORKFORCE_ROLES] },
            carer_id: null,
          },
          data: { carer_id: carerId },
        });

        if (linkResult.count !== 1) {
          throw new ConflictException(MEMBERSHIP_NOT_ELIGIBLE);
        }

        await tx.auditLog.create({
          data: {
            organization_id: organizationId,
            user_id: actorSubject,
            action: 'CARER_MEMBERSHIP_LINKED',
            resource_type: 'Carer',
            resource_id: carerId,
            old_values: {},
            new_values: {
              carerId,
              membershipId,
            },
          },
        });

        return {
          carer: this.mapCarer(carer),
          membershipId,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('A carer profile with these details already exists');
      }
      throw error;
    }
  }

  private async requireVerifiedAdmin(
    tx: TransactionClient,
    input: { organizationId: string; adminMembershipId: string; actorSubject: string },
  ): Promise<void> {
    const adminMembership = await tx.organizationMembership.findFirst({
      where: {
        id: input.adminMembershipId,
        organization_id: input.organizationId,
        auth_subject: input.actorSubject,
        status: 'ACTIVE',
        role: 'admin',
      },
      select: { id: true },
    });

    if (!adminMembership) {
      throw new ForbiddenException(ADMIN_MEMBERSHIP_REQUIRED);
    }
  }

  private isEligibleMembership(membership: {
    role?: string | null;
    status?: string | null;
    carer_id?: string | null;
  }): boolean {
    const role = (membership.role || '').trim().toLowerCase();
    return (
      membership.status === 'ACTIVE' &&
      ALLOWED_WORKFORCE_ROLES.includes(role as (typeof ALLOWED_WORKFORCE_ROLES)[number]) &&
      !membership.carer_id
    );
  }

  private normalizeProfile(input: CreateLinkedCarerInput) {
    const firstName = this.requireInputValue(input.firstName);
    const lastName = this.requireInputValue(input.lastName);
    const email = this.requireInputValue(input.email).toLowerCase();
    const phone = (input.phone || '').trim() || null;

    if (firstName.length > 100 || lastName.length > 100 || email.length > 200 || (phone && phone.length > 50)) {
      throw new BadRequestException('Carer profile fields are invalid');
    }

    return { firstName, lastName, email, phone };
  }

  private mapCarer(carer: any): CarerDTO {
    return {
      id: carer.id,
      firstName: carer.first_name,
      lastName: carer.last_name,
      email: carer.email,
      phone: carer.phone,
    };
  }

  private requirePrincipalValue(value?: string | null): string {
    const normalized = (value || '').trim();
    if (!normalized) {
      throw new ForbiddenException(ADMIN_MEMBERSHIP_REQUIRED);
    }
    return normalized;
  }

  private requireInputValue(value?: string | null): string {
    const normalized = (value || '').trim();
    if (!normalized) {
      throw new BadRequestException('Required carer profile fields are missing');
    }
    return normalized;
  }
}
