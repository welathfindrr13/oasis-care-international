import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject, Optional } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '@oasis/db';
import { Masker } from '../utils/masker';

// PII patterns to detect and mask
const PII_PATTERNS = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /(\+?44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}/g,
  nino: /[A-Z]{2}\d{6}[A-Z]/gi,
  postcode: /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/gi,
  dob: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
};

interface AuditLogEntry {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

const AUDIT_FIELD_LIMITS = {
  action: 50,
  resourceType: 50,
  ipAddress: 45,
  userAgent: 500,
  resourceId: 255,
} as const;

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType<'http' | 'graphql'>();
    let auditInfo: AuditLogEntry;

    if (contextType === 'graphql') {
      // Handle GraphQL context
      const gqlContext = GqlExecutionContext.create(context);
      const gqlCtx = gqlContext.getContext();
      const info = gqlContext.getInfo();
      const args = gqlContext.getArgs();
      const req = gqlCtx.req;

      auditInfo = {
        userId: req?.user?.sub || req?.user?.id || 'anonymous',
        action: `GraphQL ${info?.parentType?.name || ''}.${info?.fieldName || 'unknown'}`,
        resourceType: info?.parentType?.name || 'GraphQL',
        resourceId: args?.id || args?.input?.id,
        ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'],
        userAgent: req?.headers?.['user-agent'],
      };

      if (args) {
        auditInfo.newValues = this.maskPII(args);
      }
    } else {
      // Handle HTTP context
      const request = context.switchToHttp().getRequest();
      if (!request) {
        // Skip audit logging if no request context
        return next.handle();
      }
      const { method, url, user, ip, headers, body } = request;

      auditInfo = {
        userId: user?.id || 'anonymous',
        action: `${method} ${url}`,
        resourceType: this.extractResourceType(url),
        resourceId: this.extractResourceId(url),
        ipAddress: ip || headers?.['x-forwarded-for'] || headers?.['x-real-ip'],
        userAgent: headers?.['user-agent'],
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        auditInfo.newValues = this.maskPII(body);
      }
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async () => {
          const duration = Date.now() - startTime;
          await this.logToDatabase({
            ...auditInfo,
            action: `${auditInfo.action} [SUCCESS ${duration}ms]`,
          });
        },
        error: async (error) => {
          const duration = Date.now() - startTime;
          await this.logToDatabase({
            ...auditInfo,
            action: `${auditInfo.action} [ERROR ${duration}ms]`,
            newValues: this.mergeAuditNewValues(auditInfo.newValues, {
              error: this.truncate(this.maskString(String(error?.message || 'unknown error')), 2000),
            }),
          });
        },
      }),
    );
  }

  private async logToDatabase(entry: AuditLogEntry): Promise<void> {
    if (!this.prisma) {
      console.log('AUDIT LOG (no DB):', JSON.stringify(entry, null, 2));
      return;
    }

    try {
      const ipAddress = this.extractFirstIp(entry.ipAddress);
      const userAgent = this.truncate(entry.userAgent, AUDIT_FIELD_LIMITS.userAgent);
      const action =
        this.truncate(entry.action, AUDIT_FIELD_LIMITS.action) || 'UNKNOWN_ACTION';
      const resourceType =
        this.truncate(entry.resourceType, AUDIT_FIELD_LIMITS.resourceType) || 'UNKNOWN_RESOURCE';
      const resourceId = this.truncate(entry.resourceId, AUDIT_FIELD_LIMITS.resourceId);

      await this.prisma.auditLog.create({
        data: {
          user_id: entry.userId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          old_values: entry.oldValues || {},
          new_values: entry.newValues || {},
          ip_address: ipAddress,
          user_agent: userAgent,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  private extractResourceType(url: string): string {
    const pathSegments = url.split('?')[0].split('/').filter(Boolean);
    return pathSegments[0] || 'unknown';
  }

  private extractResourceId(url: string): string | undefined {
    const pathSegments = url.split('?')[0].split('/').filter(Boolean);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    for (const segment of pathSegments) {
      if (uuidPattern.test(segment)) {
        return segment;
      }
    }
    
    if (pathSegments.length > 1 && /^\d+$/.test(pathSegments[1])) {
      return pathSegments[1];
    }
    
    return undefined;
  }

  private maskPII(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      return this.maskString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskPII(item));
    }
    
    if (typeof data === 'object') {
      const masked: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(data)) {
        const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'api_key', 'ssn', 'nino'];
        
        if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
          masked[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
          masked[key] = this.maskString(value, key);
        } else if (typeof value === 'object' && value !== null) {
          masked[key] = this.maskPII(value);
        } else {
          masked[key] = value;
        }
      }
      
      return masked;
    }
    
    return data;
  }

  private maskString(value: string, fieldName?: string): string {
    let masked = value;
    
    if (fieldName) {
      const lowerField = fieldName.toLowerCase();
      
      if (lowerField.includes('email') || lowerField.includes('phone') || lowerField.includes('mobile')) {
        return Masker.mask(value);
      }
      
      if (lowerField.includes('address') || lowerField.includes('postcode')) {
        return '[ADDRESS REDACTED]';
      }
      
      if (lowerField.includes('dob') || lowerField.includes('birth') || lowerField.includes('date_of_birth')) {
        return '[DOB REDACTED]';
      }
    }
    
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      if (pattern.test(masked)) {
        if (type === 'email' || type === 'phone') {
          masked = Masker.mask(masked);
        } else if (type === 'nino') {
          masked = masked.replace(pattern, '[NINO REDACTED]');
        } else if (type === 'postcode') {
          masked = masked.replace(pattern, '[POSTCODE]');
        } else if (type === 'dob') {
          masked = masked.replace(pattern, '[DATE]');
        }
      }
    }
    
    return masked;
  }

  private truncate(value: unknown, maxLength: number): string | undefined {
    if (value === null || value === undefined) return undefined;
    const text = String(value);
    if (!text) return undefined;
    if (text.length <= maxLength) return text;
    return text.slice(0, Math.max(1, maxLength - 1));
  }

  private extractFirstIp(value: unknown): string | undefined {
    const text = this.truncate(value, 1000);
    if (!text) return undefined;
    const first = text.split(',')[0]?.trim();
    return this.truncate(first, AUDIT_FIELD_LIMITS.ipAddress);
  }

  private mergeAuditNewValues(
    current: Record<string, any> | undefined,
    extra: Record<string, any>,
  ): Record<string, any> {
    return {
      ...(current || {}),
      ...extra,
    };
  }
}
