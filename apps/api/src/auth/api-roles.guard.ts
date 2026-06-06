import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@oasis/auth';
import { Prisma, PrismaService } from '@oasis/db';
import {
  assertLegacyOperationalAccess,
  AuthRoleCarrier,
  LEGACY_OPERATIONAL_SURFACE_KEY,
} from './legacy-operational-access';

type AuthUser = AuthRoleCarrier & {
  id?: string;
  email?: string;
  organizationId?: string | null;
  organizationMembershipId?: string | null;
  authMode?: string | null;
};

type OrganizationMembershipRow = {
  id: string;
  organization_id: string;
  role: string;
  status: string;
};

@Injectable()
export class ApiRolesGuard extends RolesGuard implements CanActivate {
  private readonly appReflector: Reflector;

  constructor(
    reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super(reflector);
    this.appReflector = reflector;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = await super.canActivate(context);
    if (!allowed) {
      return false;
    }

    const request = this.getRequest(context);
    await this.enrichOrganizationContext(request?.user);
    this.assertRequiredRoles(context, request?.user);
    this.enforceLegacyOperationalAccess(context, request?.user);
    return true;
  }

  handleRequest(err: unknown, user: any): any {
    // Authenticate first. Tenant-scoped authorization runs only after the
    // verified OrganizationMembership has replaced untrusted token roles.
    this.assertAuthenticated(err, user);
    return user;
  }

  private enforceLegacyOperationalAccess(
    context: ExecutionContext,
    user: AuthUser | undefined,
  ): void {
    const isLegacyOperationalSurface = this.appReflector.getAllAndOverride<boolean>(
      LEGACY_OPERATIONAL_SURFACE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isLegacyOperationalSurface) {
      return;
    }

    assertLegacyOperationalAccess(user);
  }

  private async enrichOrganizationContext(user: AuthUser | undefined): Promise<void> {
    if (!user) {
      return;
    }

    const userId = (user.id || '').trim();
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const identityProvider = (process.env.AUTH_IDENTITY_PROVIDER || 'cognito').trim().toLowerCase();
    const tokenOrganizationId = (user.organizationId || '').trim();

    const membership = await this.resolveActiveMembership(
      identityProvider,
      userId,
      tokenOrganizationId || undefined,
    );
    if (membership) {
      this.applyMembershipToUser(user, membership);
      return;
    }

    if (this.isTenantMembershipRequired()) {
      throw new ForbiddenException(
        'Active organization membership is required for tenant-scoped access',
      );
    }

    if (tokenOrganizationId) {
      return;
    }

    const identityMapped = await this.resolveOrganizationViaIdentityMap(
      identityProvider,
      userId,
      normalizedEmail,
    );
    if (identityMapped) {
      user.organizationId = identityMapped;
      return;
    }

    const domainMapped = await this.resolveOrganizationViaEmailDomain(
      identityProvider,
      normalizedEmail,
    );
    if (domainMapped) {
      user.organizationId = domainMapped;
      await this.persistIdentityMap(identityProvider, userId, normalizedEmail, domainMapped);
      return;
    }

    const organizationIds = new Set<string>();
    if (userId) {
      const byId = await this.prisma.carer.findMany({
        where: this.prisma.whereNotDeleted({
          id: userId,
          organization_id: { not: null },
        }),
        select: { organization_id: true },
        take: 2,
      });
      byId.forEach((row) => {
        if (row.organization_id) organizationIds.add(row.organization_id);
      });
    }

    if (organizationIds.size === 0 && normalizedEmail) {
      const byEmail = await this.prisma.carer.findMany({
        where: this.prisma.whereNotDeleted({
          email: normalizedEmail,
          organization_id: { not: null },
        }),
        select: { organization_id: true },
        take: 2,
      });
      byEmail.forEach((row) => {
        if (row.organization_id) organizationIds.add(row.organization_id);
      });
    }

    if (organizationIds.size === 1) {
      const resolvedOrgId = Array.from(organizationIds)[0];
      user.organizationId = resolvedOrgId;
      await this.persistIdentityMap(identityProvider, userId, normalizedEmail, resolvedOrgId);
      return;
    }

    if (user.authMode === 'local-dev') {
      if (this.isProductionLike()) {
        throw new ForbiddenException('Local development organization fallback is not allowed in production');
      }
      const firstOrganization = await this.prisma.organization.findFirst({
        orderBy: { created_at: 'asc' },
        select: { id: true },
      });
      if (firstOrganization?.id) {
        user.organizationId = firstOrganization.id;
      }
    }
  }

  private async resolveActiveMembership(
    identityProvider: string,
    userId: string,
    organizationId?: string,
  ): Promise<OrganizationMembershipRow | null> {
    if (!userId) {
      return null;
    }

    try {
      const organizationFilter = organizationId
        ? identityProvider === 'clerk'
          ? {
              OR: [
                { organization_id: organizationId },
                { external_organization_id: organizationId },
              ],
            }
          : { organization_id: organizationId }
        : {};

      const memberships = await (this.prisma as any).organizationMembership.findMany({
        where: {
          identity_provider: identityProvider,
          auth_subject: userId,
          status: 'ACTIVE',
          ...organizationFilter,
        },
        select: {
          id: true,
          organization_id: true,
          role: true,
          status: true,
        },
        take: 2,
      });

      return memberships.length === 1 ? memberships[0] : null;
    } catch (error) {
      if (this.isMissingMembershipTableError(error)) {
        return null;
      }
      throw error;
    }
  }

  private applyMembershipToUser(user: AuthUser, membership: OrganizationMembershipRow): void {
    const normalizedRole = this.normalizeTenantRole(membership.role);
    user.organizationId = membership.organization_id;
    user.organizationMembershipId = membership.id;
    user.role = normalizedRole;

    user.realm_access = {
      roles: Array.from(new Set([normalizedRole, membership.role.toLowerCase().trim()])),
    };
  }

  private normalizeTenantRole(role: string): string {
    const normalized = (role || '').toLowerCase().trim().replace(/\s+/g, '_');
    if (normalized === 'admin') return 'admin';
    if (['carer', 'staff', 'care_manager', 'manager', 'office'].includes(normalized)) return 'carer';
    if (['user', 'family', 'client', 'viewer'].includes(normalized)) return 'user';
    throw new ForbiddenException('Unsupported organization membership role');
  }

  private isTenantMembershipRequired(): boolean {
    if ((process.env.AUTH_IDENTITY_PROVIDER || '').trim().toLowerCase() === 'clerk') {
      return true;
    }
    if ((process.env.TENANT_MEMBERSHIP_REQUIRED || '').trim().toLowerCase() === 'true') {
      return true;
    }
    return this.isProductionLike();
  }

  private isProductionLike(): boolean {
    const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
    return nodeEnv === 'production' || nodeEnv === 'staging';
  }

  private async resolveOrganizationViaIdentityMap(
    identityProvider: string,
    userId: string,
    normalizedEmail: string,
  ): Promise<string | null> {
    try {
      if (userId) {
        const bySubject = await this.prisma.organizationIdentity.findMany({
          where: {
            identity_provider: identityProvider,
            identity_subject: userId,
          },
          select: { organization_id: true },
          take: 2,
        });
        if (bySubject.length === 1) {
          return bySubject[0].organization_id;
        }
      }

      if (normalizedEmail) {
        const byEmail = await this.prisma.organizationIdentity.findMany({
          where: {
            identity_provider: identityProvider,
            normalized_email: normalizedEmail,
          },
          select: { organization_id: true },
          take: 2,
        });
        if (byEmail.length === 1) {
          return byEmail[0].organization_id;
        }
      }
    } catch (error) {
      if (!this.isMissingIdentityTableError(error)) {
        throw error;
      }
    }

    return null;
  }

  private async resolveOrganizationViaEmailDomain(
    identityProvider: string,
    normalizedEmail: string,
  ): Promise<string | null> {
    const parts = normalizedEmail.split('@');
    const domain = parts.length === 2 ? parts[1] : '';
    if (!domain) {
      return null;
    }

    try {
      const matches = await this.prisma.organizationIdentity.findMany({
        where: {
          identity_provider: identityProvider,
          normalized_email: {
            endsWith: `@${domain}`,
          },
        },
        select: { organization_id: true },
        take: 10,
      });

      const organizationIds = new Set(
        matches
          .map((row) => row.organization_id)
          .filter((value): value is string => Boolean(value)),
      );

      return organizationIds.size === 1 ? Array.from(organizationIds)[0] : null;
    } catch (error) {
      if (this.isMissingIdentityTableError(error)) {
        return null;
      }
      throw error;
    }
  }

  private async persistIdentityMap(
    identityProvider: string,
    userId: string,
    normalizedEmail: string,
    organizationId: string,
  ): Promise<void> {
    try {
      if (userId) {
        await this.prisma.organizationIdentity.upsert({
          where: {
            identity_provider_identity_subject: {
              identity_provider: identityProvider,
              identity_subject: userId,
            },
          },
          update: {
            organization_id: organizationId,
            normalized_email: normalizedEmail || null,
            notes: 'autolink:carer-lookup',
          },
          create: {
            organization_id: organizationId,
            identity_provider: identityProvider,
            identity_subject: userId,
            normalized_email: normalizedEmail || null,
            notes: 'autolink:carer-lookup',
          },
        });
        return;
      }

      if (normalizedEmail) {
        await this.prisma.organizationIdentity.upsert({
          where: {
            identity_provider_normalized_email: {
              identity_provider: identityProvider,
              normalized_email: normalizedEmail,
            },
          },
          update: {
            organization_id: organizationId,
            notes: 'autolink:carer-lookup',
          },
          create: {
            organization_id: organizationId,
            identity_provider: identityProvider,
            normalized_email: normalizedEmail,
            notes: 'autolink:carer-lookup',
          },
        });
      }
    } catch (error) {
      if (this.isMissingIdentityTableError(error)) {
        return;
      }
      // Do not block auth on best-effort linking.
      if ((error as { code?: string })?.code === 'P2002') {
        return;
      }
    }
  }

  private isMissingIdentityTableError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2021';
    }
    return false;
  }

  private isMissingMembershipTableError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2021';
    }
    return false;
  }
}
