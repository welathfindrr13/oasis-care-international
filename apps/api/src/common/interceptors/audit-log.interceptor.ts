import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;
    
    // Extract basic audit info (no PHI until properly wired)
    const auditInfo = {
      userId: user?.id || 'anonymous',
      action: `${method} ${url}`,
      resourceType: this.extractResourceType(url),
      ipAddress: ip || headers['x-forwarded-for'] || headers['x-real-ip'],
      userAgent: headers['user-agent'],
      timestamp: new Date(),
    };

    // TODO: Log to audit_log table when fully implemented
    console.log('AUDIT LOG STUB:', JSON.stringify(auditInfo, null, 2));

    return next.handle().pipe(
      tap({
        next: (response) => {
          // TODO: Log successful response details
          console.log('AUDIT LOG STUB - Success:', { action: auditInfo.action });
        },
        error: (error) => {
          // TODO: Log error details  
          console.log('AUDIT LOG STUB - Error:', { action: auditInfo.action, error: error.message });
        },
      }),
    );
  }

  private extractResourceType(url: string): string {
    // Extract resource type from URL path
    const pathSegments = url.split('/').filter(Boolean);
    return pathSegments[0] || 'unknown';
  }
}
