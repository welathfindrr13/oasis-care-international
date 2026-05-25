import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '@oasis/db';
import { ApiRolesGuard } from './api-roles.guard';

@Injectable()
export class GqlRolesGuard extends ApiRolesGuard {
  constructor(
    reflector: Reflector,
    prisma: PrismaService,
  ) {
    super(reflector, prisma);
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
