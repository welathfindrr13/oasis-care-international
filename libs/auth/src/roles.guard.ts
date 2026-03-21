import { Injectable, CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { extractRoles, normalizeRole } from './role-utils';

const JwtAuthGuard = AuthGuard('jwt') as Type<CanActivate>;

@Injectable()
export class RolesGuard extends JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  getRequest(context: ExecutionContext) {
    if (context.getType<string>() === 'http') {
      return context.switchToHttp().getRequest();
    }

    if (context.getType<string>() === 'graphql') {
      return context.getArgByIndex(2)?.req;
    }

    return context.switchToHttp().getRequest();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First check JWT authentication
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // Then check roles
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = this.getRequest(context);
    const user = request.user;

    const userRoles = extractRoles(user);
    if (userRoles.length === 0) {
      return false;
    }

    return requiredRoles
      .map(normalizeRole)
      .some((role) => userRoles.includes(role));
  }
}
