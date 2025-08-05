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
      const payload_data = JSON.parse(Buffer.from(payload, 'base64').toString());
      
      // Transform the user object to match what JWT strategy returns
      const user = {
        id: payload_data.sub,  // Map sub to id for resolver compatibility
        sub: payload_data.sub,
        username: payload_data.preferred_username,
        role: payload_data.realm_access?.roles?.[0] || 'user',  // Extract role for resolver compatibility
        realm_access: payload_data.realm_access,
        resource_access: payload_data.resource_access,
      };
      
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
