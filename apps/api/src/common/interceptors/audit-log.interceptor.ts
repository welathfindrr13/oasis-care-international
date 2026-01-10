import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject, Optional } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
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

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers, body } = request;
    
    const auditInfo: AuditLogEntry = {
      userId: user?.id || 'anonymous',
      action: `${method} ${url}`,
      resourceType: this.extractResourceType(url),
      resourceId: this.extractResourceId(url),
      ipAddress: ip || headers['x-forwarded-for'] || headers['x-real-ip'],
      userAgent: headers['user-agent'],
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      auditInfo.newValues = this.maskPII(body);
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
            action: `${auditInfo.action} [ERROR ${duration}ms: ${error.message}]`,
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
      await this.prisma.auditLog.create({
        data: {
          user_id: entry.userId,
          action: entry.action,
          resource_type: entry.resourceType,
          resource_id: entry.resourceId,
          old_values: entry.oldValues || {},
          new_values: entry.newValues || {},
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent,
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
}
