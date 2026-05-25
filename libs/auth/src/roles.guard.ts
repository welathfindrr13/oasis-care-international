import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Type,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

const JwtAuthGuard = AuthGuard('jwt') as Type<CanActivate>;

@Injectable()
export class RolesGuard extends JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    return true;
  }

  handleRequest(err: unknown, user: any, _info: unknown, context: ExecutionContext): any {
    if (err || !user) {
      throw (err as Error) || new UnauthorizedException('Unauthorized');
    }

    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) {
      return user;
    }

    const normalizedUserRoles = new Set<string>();
    if (typeof user.role === 'string' && user.role.trim().length > 0) {
      normalizedUserRoles.add(user.role.toLowerCase().trim());
    }
    if (Array.isArray(user.realm_access?.roles)) {
      for (const role of user.realm_access.roles) {
        const normalized = String(role).toLowerCase().trim();
        if (normalized) normalizedUserRoles.add(normalized);
      }
    }

    const hasRole = requiredRoles.some((role) =>
      normalizedUserRoles.has(String(role).toLowerCase().trim())
    );

    if (!hasRole) {
      throw new ForbiddenException('Forbidden resource');
    }

    return user;
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest();
  }
}
