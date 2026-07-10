import { ForbiddenException, Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '@oasis/db';
import { CarerAccessService } from '../carer/carer-access.service';
import { ApiRolesGuard } from './api-roles.guard';

@Injectable()
export class GqlRolesGuard extends ApiRolesGuard {
  private readonly roleReflector: Reflector;

  constructor(
    reflector: Reflector,
    prisma: PrismaService,
    private readonly carerAccessService: CarerAccessService,
  ) {
    super(reflector, prisma);
    this.roleReflector = reflector;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = await super.canActivate(context);
    if (!allowed) {
      return false;
    }

    const user = this.getRequest(context)?.user;
    const membershipRole = String(user?.organizationMembershipRole || user?.role || '')
      .trim()
      .toLowerCase();
    const requiredRoles = (this.roleReflector.get<string[]>('roles', context.getHandler()) || []).map((role) =>
      String(role).trim().toLowerCase(),
    );

    if (membershipRole === 'carer' || membershipRole === 'staff') {
      const identity = await this.carerAccessService.requireCarerIdentity({
        organizationMembershipId: user?.organizationMembershipId,
        organizationId: user?.organizationId,
        authSubject: user?.sub || user?.id,
      });
      user.carerId = identity.carerId;
      return true;
    }

    if (user?.role === 'carer' && requiredRoles.includes('carer') && !requiredRoles.includes(membershipRole)) {
      throw new ForbiddenException('Forbidden resource');
    }

    return true;
  }

  // Provide `req` to passport-jwt from GraphQL context.
  getRequest(context: ExecutionContext) {
    if (context.getType<'graphql'>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context).getContext();
      return gqlCtx?.req;
    }
    return context.switchToHttp().getRequest();
  }
}
