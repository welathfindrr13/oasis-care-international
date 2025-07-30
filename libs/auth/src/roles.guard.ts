import { Injectable, CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

const JwtAuthGuard = AuthGuard('jwt') as Type<CanActivate>;

@Injectable()
export class RolesGuard extends JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
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

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user || !user.realm_access?.roles) {
      return false;
    }

    return requiredRoles.some((role) => user.realm_access.roles.includes(role));
  }
}
