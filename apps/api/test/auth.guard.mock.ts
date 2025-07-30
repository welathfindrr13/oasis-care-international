import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    
    // Extract the mock user from the Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return false;
    }

    // Parse the mock token to get user info
    const token = authHeader.replace('Bearer ', '');
    const [, payload] = token.split('.');
    
    if (!payload) {
      return false;
    }

    try {
      const user = JSON.parse(Buffer.from(payload, 'base64').toString());
      request.user = user;
      
      // Check roles if required
      const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }

      if (!user.realm_access?.roles) {
        return false;
      }

      return requiredRoles.some((role) => user.realm_access.roles.includes(role));
    } catch (error) {
      return false;
    }
  }
}
