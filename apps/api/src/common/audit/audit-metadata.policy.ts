import { GraphQLError } from 'graphql';
import { BaseHttpException } from '../errors/base-http.exception';

const AUDIT_METADATA_LIMITS = {
  depth: 4,
  entries: 24,
  identifier: 255,
  workflowArray: 20,
} as const;

const EXCLUDED_METADATA_FIELD =
  /(address|allerg|api.?key|birth|body|care.?note|clinical|comment|concern|condition|diagnos|dob|dosage|email|instruction|medicat|message|nino|note|outcome|password|phone|postcode|reason|safeguard|secret|symptom|text|timestamp|token)/i;

const INTERNAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRUSTED_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

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
  'ACKNOWLEDGED',
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
  'ESCALATED',
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
  'RESOLVED',
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

export type AuditIdentifierSource = 'request' | 'trusted';

export interface AuditMetadataPolicyOptions {
  identifierSource?: AuditIdentifierSource;
}

export type AuditMetadataValue = string | number | boolean | string[];
export type SanitizedAuditMetadata = Record<string, AuditMetadataValue>;

export function sanitizeAuditMetadata(
  data: unknown,
  options: AuditMetadataPolicyOptions = {},
): SanitizedAuditMetadata {
  const result: SanitizedAuditMetadata = {};
  const identifierSource = options.identifierSource || 'request';
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
      for (const item of value.slice(0, AUDIT_METADATA_LIMITS.workflowArray)) {
        visit(item, depth + 1);
      }
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      if (entryCount >= AUDIT_METADATA_LIMITS.entries) return;
      const normalizedKey = normalizeMetadataKey(key);
      if (!normalizedKey || EXCLUDED_METADATA_FIELD.test(normalizedKey)) {
        continue;
      }

      const identifierField = IDENTIFIER_FIELDS[normalizedKey];
      if (identifierField) {
        const identifier =
          identifierSource === 'trusted'
            ? sanitizeTrustedAuditIdentifier(item)
            : sanitizeAuditResourceId(item);
        if (identifier && result[identifierField] === undefined) {
          result[identifierField] = identifier;
          entryCount += 1;
        }
        continue;
      }

      const workflowField = WORKFLOW_FIELDS[normalizedKey];
      if (workflowField) {
        const workflowValue = sanitizeWorkflowValue(item);
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

/**
 * Authenticated provenance and identifiers loaded from authorized records may
 * use provider-style IDs as well as UUIDs. Request arguments must use
 * sanitizeAuditResourceId instead.
 */
export function sanitizeTrustedAuditIdentifier(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  if (
    !text ||
    text.length > AUDIT_METADATA_LIMITS.identifier ||
    !TRUSTED_IDENTIFIER_PATTERN.test(text)
  ) {
    return undefined;
  }
  return text;
}

export function sanitizeAuditResourceId(value: unknown): string | undefined {
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

export function extractSafeAuditErrorMetadata(
  error: unknown,
): Record<string, unknown> {
  const err = error as { code?: unknown; name?: unknown };
  const directCode = sanitizeAuditErrorToken(err?.code, 100);
  const baseHttpCode =
    !directCode && error instanceof BaseHttpException
      ? extractBaseHttpErrorCode(error)
      : undefined;
  const graphQlCode =
    !directCode && !baseHttpCode && error instanceof GraphQLError
      ? sanitizeAuditErrorToken(error.extensions?.code, 100)
      : undefined;
  const errorCode = directCode || baseHttpCode || graphQlCode;

  return {
    errorName: sanitizeAuditErrorToken(err?.name, 64) || 'Error',
    ...(errorCode ? { errorCode } : {}),
  };
}

export function sanitizeAuditErrorToken(
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

function extractBaseHttpErrorCode(
  error: BaseHttpException,
): string | undefined {
  const response = error.getResponse();
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return undefined;
  }
  return sanitizeAuditErrorToken(
    (response as Record<string, unknown>).code,
    100,
  );
}

function normalizeMetadataKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function sanitizeWorkflowValue(value: unknown): AuditMetadataValue | undefined {
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
      .map((item) => sanitizeWorkflowValue(item))
      .filter((item): item is string => typeof item === 'string');
    return safe.length ? safe : undefined;
  }
  return undefined;
}
