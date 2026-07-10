import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AccessContextService } from './access-context.service';
import { ApiRolesGuard } from './api-roles.guard';

@Injectable()
export class GqlRolesGuard extends ApiRolesGuard {
  constructor(reflector: Reflector, accessContextService: AccessContextService) {
    super(reflector, accessContextService);
  }

  getRequest(context: ExecutionContext) {
    if (context.getType<'graphql'>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext()?.req;
    }
    return context.switchToHttp().getRequest();
  }
}
