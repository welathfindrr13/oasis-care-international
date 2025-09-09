import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class DemoAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (process.env.DEMO_MODE !== 'true') {
      return true; // Pass through to normal auth
    }

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    // If demo mode and has demo token, set demo user
    if (authorization && authorization.startsWith('Bearer DEMO_')) {
      request.user = {
        sub: 'demo-user',
        role: 'ADMIN',
        email: 'admin@demo.local',
      };
      return true;
    }

    return true; // Pass through to normal auth
  }
}
