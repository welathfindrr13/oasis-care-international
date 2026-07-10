import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@oasis/auth';
import {
  AccessContextService,
  ACCESS_UNAVAILABLE_MESSAGE,
  AuthenticatedRequest,
  CanonicalAccessContext,
} from './access-context.service';
import {
  assertLegacyOperationalAccess,
  AuthRoleCarrier,
  LEGACY_OPERATIONAL_SURFACE_KEY,
} from './legacy-operational-access';

export type AccessEnrichedAuthUser = AuthRoleCarrier & {
  id?: string;
  sub?: string;
  organizationId?: string | null;
  organizationMembershipId?: string | null;
  organizationMembershipRole?: string | null;
  carerId?: string | null;
  accessContext?: CanonicalAccessContext | null;
};

type AccessEnrichedRequest = AuthenticatedRequest & {
  user?: AccessEnrichedAuthUser;
};

@Injectable()
export class ApiRolesGuard extends RolesGuard implements CanActivate {
  private readonly appReflector: Reflector;

  constructor(
    reflector: Reflector,
    private readonly accessContextService: AccessContextService,
  ) {
    super(reflector);
    this.appReflector = reflector;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const request = this.getRequest(context) as AccessEnrichedRequest | undefined;
    const user = request?.user;
    if (!user) {
      throw new ForbiddenException(ACCESS_UNAVAILABLE_MESSAGE);
    }

    const access = this.accessContextService.requirePermitted(
      await this.accessContextService.resolveForRequest(request),
    );
    this.applyAccessContext(user, access);
    this.assertRequiredRoles(context, user);
    this.preventNormalizedRoleConfusion(context, user, access);
    this.enforceLegacyOperationalAccess(context, user);
    return true;
  }

  handleRequest(err: unknown, user: any): any {
    this.assertAuthenticated(err, user);
    return user;
  }

  private applyAccessContext(user: AccessEnrichedAuthUser, access: CanonicalAccessContext): void {
    const canonicalRole = canonicalApiRole(access.surface);
    user.accessContext = access;
    user.organizationId = access.organizationId;
    user.organizationMembershipId = access.membershipId;
    user.organizationMembershipRole = access.rawRole;
    user.carerId = access.surface === 'STAFF' && access.domainIdentityId ? access.domainIdentityId : null;
    user.role = canonicalRole;
    user.realm_access = {
      roles: Array.from(new Set([canonicalRole, access.rawRole].filter(Boolean) as string[])),
    };
  }

  private preventNormalizedRoleConfusion(
    context: ExecutionContext,
    user: AccessEnrichedAuthUser,
    access: CanonicalAccessContext,
  ): void {
    const requiredRoles = (this.appReflector.get<string[]>('roles', context.getHandler()) || []).map((role) =>
      String(role).trim().toLowerCase(),
    );
    if (
      user.role === 'carer' &&
      requiredRoles.includes('carer') &&
      access.effectiveRole !== 'carer' &&
      !requiredRoles.includes(String(access.rawRole || '').toLowerCase())
    ) {
      throw new ForbiddenException('Forbidden resource');
    }
  }

  private enforceLegacyOperationalAccess(context: ExecutionContext, user: AccessEnrichedAuthUser): void {
    const isLegacyOperationalSurface = this.appReflector.getAllAndOverride<boolean>(LEGACY_OPERATIONAL_SURFACE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isLegacyOperationalSurface) {
      assertLegacyOperationalAccess(user);
    }
  }
}

function canonicalApiRole(surface: CanonicalAccessContext['surface']): string {
  if (surface === 'ADMIN') return 'admin';
  if (surface === 'STAFF') return 'carer';
  if (surface === 'FAMILY') return 'user';
  throw new ForbiddenException(ACCESS_UNAVAILABLE_MESSAGE);
}
