import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isIP } from 'node:net';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { Prisma, PrismaService } from '@oasis/db';
import { MANUAL_AUDIT_KEY } from '../decorators/manual-audit.decorator';

const AUDIT_METADATA_LIMITS = {
  depth: 4,
  entries: 24,
  identifier: 255,
  workflowArray: 20,
} as const;

const EXCLUDED_AUDIT_DOMAIN =
  /(clinical|safeguard|medicat|medicine|prescription|dose|e-?mar|concern)/i;

const EXCLUDED_METADATA_FIELD =
  /(address|allerg|api.?key|birth|body|care.?note|clinical|comment|concern|condition|diagnos|dob|dosage|email|instruction|medicat|message|nino|note|password|phone|postcode|reason|safeguard|secret|symptom|text|token)/i;

const INTERNAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IDENTIFIER_FIELDS: Readonly<Record<string, string>> = {
  id: 'id',
  accessgrantid: 'accessGrantId',
  actorid: 'actorId',
  assessmentid: 'assessmentId',
  careplanid: 'carePlanId',
  carerid: 'carerId',
  careroomid: 'careRoomId',
  clientid: 'clientId',
  evidenceitemid: 'evidenceItemId',
  evidencepackid: 'evidencePackId',
  familycontactid: 'familyContactId',
  invitationid: 'invitationId',
  membershipid: 'membershipId',
  organizationid: 'organizationId',
  organizationmembershipid: 'organizationMembershipId',
  requestid: 'requestId',
  shiftid: 'shiftId',
  sourcerequestid: 'sourceRequestId',
  storyid: 'storyId',
  taskid: 'taskId',
  userid: 'userId',
  verifiedvisitstoryid: 'verifiedVisitStoryId',
  visitid: 'visitId',
  visittaskid: 'visitTaskId',
};

const WORKFLOW_FIELDS: Readonly<Record<string, string>> = {
  active: 'active',
  approved: 'approved',
  count: 'count',
  enabled: 'enabled',
  eventtype: 'eventType',
  granttype: 'grantType',
  isactive: 'isActive',
  limit: 'limit',
  nextstate: 'nextState',
  nextstatus: 'nextStatus',
  offset: 'offset',
  operation: 'operation',
  page: 'page',
  previousstate: 'previousState',
  previousstatus: 'previousStatus',
  published: 'published',
  revoked: 'revoked',
  role: 'role',
  roles: 'roles',
  scope: 'scope',
  scopes: 'scopes',
  state: 'state',
  status: 'status',
  version: 'version',
};

const SAFE_WORKFLOW_TOKENS = new Set([
  'ACCEPTED',
  'ACTIVE',
  'ADMIN',
  'APPROVED',
  'ARCHIVED',
  'CARER',
  'CARE_WORKER',
  'CANCELLED',
  'COMPILED',
  'COMPLETED',
  'DELIVERED',
  'DISABLED',
  'DRAFT',
  'EXPIRED',
  'FAMILY',
  'FAMILY_CONTRIBUTOR',
  'FAMILY_VIEWER',
  'INACTIVE',
  'IN_PROGRESS',
  'IN_REVIEW',
  'INVITED',
  'MANAGER',
  'NEEDS_ATTENTION',
  'PENDING',
  'PENDING_APPROVAL',
  'PROCESSING',
  'PUBLISHED',
  'REJECTED',
  'RETRYABLE',
  'REVOKED',
  'SCHEDULED',
  'SUBMIT_PULSE',
  'SUPERSEDED',
  'SUSPENDED',
  'VIEW_TASK_SUMMARY',
  'VIEW_UPDATES',
  'VIEW_VISIT_TIMES',
  'VIEW_WEEKLY_SUMMARIES',
]);

interface AuditLogEntry {
  organizationId?: string | null;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

type AuditLogCreateData = {
  user_id: string;
  organization_id: string | null;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values: Prisma.InputJsonValue;
  new_values: Prisma.InputJsonValue;
  ip_address?: string;
  timestamp: Date;
};

const AUDIT_FIELD_LIMITS = {
  action: 50,
  resourceType: 50,
  ipAddress: 45,
  resourceId: 255,
} as const;

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
    @Optional() @Inject(Reflector) private readonly reflector?: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (
      this.reflector?.getAllAndOverride<boolean>(MANUAL_AUDIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return next.handle();
    }

    const contextType = context.getType<'http' | 'graphql'>();
    let auditInfo: AuditLogEntry;

    if (contextType === 'graphql') {
      // Handle GraphQL context
      const gqlContext = GqlExecutionContext.create(context);
      const gqlCtx = gqlContext.getContext();
      const info = gqlContext.getInfo();
      const args = gqlContext.getArgs();
      const req = gqlCtx.req;
      const parentType =
        this.sanitizeSchemaName(info?.parentType?.name) || 'GraphQL';
      const fieldName = this.sanitizeSchemaName(info?.fieldName) || 'unknown';

      auditInfo = {
        userId: req?.user?.sub || req?.user?.id || 'anonymous',
        organizationId: req?.user?.organizationId ?? null,
        action: `GraphQL ${parentType}.${fieldName}`,
        resourceType: parentType,
        resourceId: this.extractGraphqlResourceId(args),
        ipAddress:
          req?.ip ||
          req?.headers?.['x-forwarded-for'] ||
          req?.headers?.['x-real-ip'],
      };

      if (args && !this.isExcludedAuditDomain(auditInfo)) {
        auditInfo.newValues = this.extractAllowedMetadata(args);
      }
    } else {
      // Handle HTTP context
      const request = context.switchToHttp().getRequest();
      if (!request) {
        // Skip audit logging if no request context
        return next.handle();
      }
      const { method, url, user, ip, headers, body, route } = request;
      const resourceType = this.extractResourceType(url);
      const safeMethod = this.sanitizeHttpMethod(method);

      auditInfo = {
        userId: user?.id || 'anonymous',
        organizationId: user?.organizationId ?? null,
        action: this.createHttpAction(
          context,
          safeMethod,
          resourceType,
          route?.path,
        ),
        resourceType,
        resourceId: this.extractResourceId(url),
        ipAddress: ip || headers?.['x-forwarded-for'] || headers?.['x-real-ip'],
      };

      if (
        body &&
        ['POST', 'PUT', 'PATCH'].includes(safeMethod) &&
        !this.isExcludedAuditDomain(auditInfo)
      ) {
        auditInfo.newValues = this.extractAllowedMetadata(body);
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
            newValues: this.mergeAuditNewValues(
              auditInfo.newValues,
              this.extractSafeErrorMetadata(error),
            ),
          });
        },
      }),
    );
  }

  private async logToDatabase(entry: AuditLogEntry): Promise<void> {
    if (!this.prisma) {
      const data = this.createAuditLogData(entry);
      console.log('AUDIT LOG (no DB):', {
        userId: data.user_id,
        organizationId: data.organization_id,
        action: data.action,
        resourceType: data.resource_type,
        resourceId: data.resource_id,
      });
      return;
    }

    try {
      const data = this.createAuditLogData(entry);

      try {
        await this.prisma.auditLog.create({ data });
      } catch (error) {
        if (
          this.isAuditOrganizationForeignKeyError(error) &&
          data.organization_id
        ) {
          console.warn(
            'Audit log organization FK failed; retrying without organization_id',
            this.safePrismaErrorSummary(error),
          );
          await this.prisma.auditLog.create({
            data: {
              ...data,
              organization_id: null,
            },
          });
          return;
        }

        throw error;
      }
    } catch (error) {
      console.error(
        'Failed to write audit log:',
        this.safePrismaErrorSummary(error),
      );
    }
  }

  private createAuditLogData(entry: AuditLogEntry): AuditLogCreateData {
    const ipAddress = this.extractFirstIp(entry.ipAddress);
    const userId =
      this.sanitizeTrustedProvenanceIdentifier(entry.userId) || 'anonymous';
    const organizationId =
      this.sanitizeTrustedProvenanceIdentifier(entry.organizationId) || null;
    const action =
      this.truncate(entry.action, AUDIT_FIELD_LIMITS.action) ||
      'UNKNOWN_ACTION';
    const resourceType =
      this.truncate(entry.resourceType, AUDIT_FIELD_LIMITS.resourceType) ||
      'UNKNOWN_RESOURCE';
    const resourceId = this.sanitizeInternalResourceId(
      this.truncate(entry.resourceId, AUDIT_FIELD_LIMITS.resourceId),
    );

    return {
      user_id: userId,
      organization_id: organizationId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: (entry.oldValues || {}) as Prisma.InputJsonObject,
      new_values: (entry.newValues || {}) as Prisma.InputJsonObject,
      ip_address: ipAddress,
      timestamp: new Date(),
    };
  }

  private isAuditOrganizationForeignKeyError(error: unknown): boolean {
    const code = (error as { code?: unknown })?.code;
    if (code !== 'P2003') return false;

    const meta = (error as { meta?: Record<string, unknown> })?.meta || {};
    const modelName = String(meta.modelName || '');
    if (modelName && modelName !== 'AuditLog') {
      return false;
    }

    const fieldHints = this.extractPrismaMetaFieldHints(meta);
    if (fieldHints.length === 0) {
      return false;
    }

    return fieldHints.some((hint) => this.isAuditOrganizationFieldHint(hint));
  }

  private safePrismaErrorSummary(error: unknown): Record<string, unknown> {
    const err = error as {
      code?: unknown;
      meta?: Record<string, unknown>;
      name?: string;
    };
    const meta = err?.meta || {};
    const fieldHints = this.extractPrismaMetaFieldHints(meta);

    return {
      name: this.sanitizeErrorToken(err?.name, 64) || 'Error',
      code: this.sanitizeErrorToken(err?.code, 100),
      modelName: this.sanitizeErrorToken(meta.modelName, 64),
      fieldName: this.sanitizeErrorToken(
        typeof meta.field_name === 'string'
          ? meta.field_name
          : typeof meta.fieldName === 'string'
            ? meta.fieldName
            : fieldHints[0],
        100,
      ),
    };
  }

  private extractPrismaMetaFieldHints(meta: Record<string, unknown>): string[] {
    const fieldKeys = [
      'field_name',
      'fieldName',
      'fields',
      'fieldNames',
      'target',
      'constraint',
      'constraintName',
      'constraint_name',
      'index',
      'indexName',
    ];

    return fieldKeys.flatMap((key) => this.flattenPrismaMetaValue(meta[key]));
  }

  private flattenPrismaMetaValue(value: unknown): string[] {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.flattenPrismaMetaValue(item));
    }

    return [];
  }

  private isAuditOrganizationFieldHint(value: string): boolean {
    const hint = value.toLowerCase();
    return (
      hint.includes('audit_log_organization_id_fkey') ||
      hint === 'organization_id' ||
      hint.includes('organization_id') ||
      hint === 'organization'
    );
  }

  private extractResourceType(url: unknown): string {
    const pathSegments = String(url || '')
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    return this.sanitizeSchemaName(pathSegments[0]) || 'unknown';
  }

  private extractResourceId(url: unknown): string | undefined {
    const pathSegments = String(url || '')
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    for (const segment of pathSegments) {
      const resourceId = this.sanitizeInternalResourceId(segment);
      if (resourceId) return resourceId;
    }

    return undefined;
  }

  private extractGraphqlResourceId(args: unknown): string | undefined {
    if (!args || typeof args !== 'object' || Array.isArray(args))
      return undefined;
    const values = args as Record<string, unknown>;
    const input =
      values.input &&
      typeof values.input === 'object' &&
      !Array.isArray(values.input)
        ? (values.input as Record<string, unknown>)
        : undefined;
    return (
      this.sanitizeInternalResourceId(values.id) ||
      this.sanitizeInternalResourceId(input?.id)
    );
  }

  private isExcludedAuditDomain(
    entry: Pick<AuditLogEntry, 'action' | 'resourceType'>,
  ): boolean {
    return EXCLUDED_AUDIT_DOMAIN.test(`${entry.action} ${entry.resourceType}`);
  }

  private extractAllowedMetadata(data: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let entryCount = 0;

    const visit = (value: unknown, depth: number): void => {
      if (
        entryCount >= AUDIT_METADATA_LIMITS.entries ||
        depth > AUDIT_METADATA_LIMITS.depth ||
        !value ||
        typeof value !== 'object'
      ) {
        return;
      }

      if (Array.isArray(value)) {
        for (const item of value.slice(
          0,
          AUDIT_METADATA_LIMITS.workflowArray,
        )) {
          visit(item, depth + 1);
        }
        return;
      }

      for (const [key, item] of Object.entries(value)) {
        if (entryCount >= AUDIT_METADATA_LIMITS.entries) return;
        const normalizedKey = this.normalizeMetadataKey(key);
        if (!normalizedKey || EXCLUDED_METADATA_FIELD.test(normalizedKey))
          continue;

        const identifierField = IDENTIFIER_FIELDS[normalizedKey];
        if (identifierField) {
          const identifier = this.sanitizeInternalResourceId(item);
          if (identifier && result[identifierField] === undefined) {
            result[identifierField] = identifier;
            entryCount += 1;
          }
          continue;
        }

        const workflowField = WORKFLOW_FIELDS[normalizedKey];
        if (workflowField) {
          const workflowValue = this.sanitizeWorkflowValue(item);
          if (
            workflowValue !== undefined &&
            result[workflowField] === undefined
          ) {
            result[workflowField] = workflowValue;
            entryCount += 1;
          }
          continue;
        }

        visit(item, depth + 1);
      }
    };

    visit(data, 0);
    return result;
  }

  private normalizeMetadataKey(value: string): string {
    return value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }

  /**
   * Actor and tenant values are supplied by the authenticated access context,
   * not copied from request arguments. They may use provider subjects as well
   * as UUIDs, so keep their proven identifier grammar separate from resource IDs.
   */
  private sanitizeTrustedProvenanceIdentifier(
    value: unknown,
  ): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number')
      return undefined;
    const text = String(value).trim();
    if (
      !text ||
      text.length > AUDIT_METADATA_LIMITS.identifier ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(text)
    ) {
      return undefined;
    }
    return text;
  }

  /** Request-controlled record identifiers must match the Prisma UUID grammar. */
  private sanitizeInternalResourceId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    if (
      !text ||
      text.length > AUDIT_METADATA_LIMITS.identifier ||
      !INTERNAL_UUID_PATTERN.test(text)
    ) {
      return undefined;
    }
    return text;
  }

  private sanitizeWorkflowValue(value: unknown): unknown {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000
        ? value
        : undefined;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      return SAFE_WORKFLOW_TOKENS.has(normalized) ? normalized : undefined;
    }
    if (Array.isArray(value)) {
      const safe = value
        .slice(0, AUDIT_METADATA_LIMITS.workflowArray)
        .map((item) => this.sanitizeWorkflowValue(item))
        .filter((item): item is string => typeof item === 'string');
      return safe.length ? safe : undefined;
    }
    return undefined;
  }

  private extractSafeErrorMetadata(error: unknown): Record<string, unknown> {
    const err = error as { code?: unknown; name?: unknown };
    return {
      errorName: this.sanitizeErrorToken(err?.name, 64) || 'Error',
      ...(this.sanitizeErrorToken(err?.code, 100)
        ? { errorCode: this.sanitizeErrorToken(err?.code, 100) }
        : {}),
    };
  }

  private sanitizeErrorToken(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    if (!text || text.length > maxLength || !/^[A-Za-z0-9_.:-]+$/.test(text)) {
      return undefined;
    }
    return text;
  }

  private sanitizeSchemaName(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(text)) return undefined;
    return text;
  }

  private sanitizeHttpMethod(value: unknown): string {
    const method = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return /^[A-Z]{1,10}$/.test(method) ? method : 'UNKNOWN';
  }

  private createHttpAction(
    context: ExecutionContext,
    method: string,
    resourceType: string,
    routePath: unknown,
  ): string {
    const controllerName = this.extractControllerName(context);
    const routeTemplate = this.sanitizeRouteTemplate(routePath);
    if (routeTemplate) {
      const routeIdentity = controllerName
        ? `${controllerName}/${routeTemplate}`
        : routeTemplate;
      return `HTTP ${method} ${routeIdentity}`;
    }

    const handlerName = this.extractHandlerName(context);
    if (handlerName) {
      const handlerIdentity = controllerName
        ? `${controllerName}#${handlerName}`
        : handlerName;
      return `HTTP ${method} ${handlerIdentity}`;
    }

    return `HTTP ${method} ${resourceType}`;
  }

  private sanitizeRouteTemplate(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const segments = value.split('/').filter(Boolean);
    if (!segments.length || segments.length > 8) return undefined;

    const safeSegments: string[] = [];
    for (const segment of segments) {
      if (segment.startsWith(':')) {
        safeSegments.push(':id');
        continue;
      }

      const safeSegment = this.sanitizeSchemaName(segment);
      if (!safeSegment) return undefined;
      safeSegments.push(safeSegment);
    }

    return safeSegments.join('/');
  }

  private extractHandlerName(context: ExecutionContext): string | undefined {
    try {
      return this.sanitizeSchemaName(context.getHandler()?.name);
    } catch {
      return undefined;
    }
  }

  private extractControllerName(context: ExecutionContext): string | undefined {
    try {
      const name = context.getClass()?.name;
      if (typeof name !== 'string') return undefined;
      return this.sanitizeSchemaName(name.replace(/Controller$/, ''));
    } catch {
      return undefined;
    }
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
    if (!first || !isIP(first)) return undefined;
    return this.truncate(first, AUDIT_FIELD_LIMITS.ipAddress);
  }

  private mergeAuditNewValues(
    current: Record<string, unknown> | undefined,
    extra: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...(current || {}),
      ...extra,
    };
  }
}
