
Object.defineProperty(exports, "__esModule", { value: true });

const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  NotFoundError,
  getPrismaClient,
  sqltag,
  empty,
  join,
  raw,
  Decimal,
  Debug,
  objectEnumValues,
  makeStrictEnum,
  Extensions,
  warnOnce,
  defineDmmfProperty,
  Public,
  detectRuntime,
} = require('./runtime/edge')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.8.0
 * Query Engine version: 0a83d8541752d7582de2ebc1ece46519ce72a848
 */
Prisma.prismaVersion = {
  client: "5.8.0",
  engine: "0a83d8541752d7582de2ebc1ece46519ce72a848"
}

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError
Prisma.PrismaClientInitializationError = PrismaClientInitializationError
Prisma.PrismaClientValidationError = PrismaClientValidationError
Prisma.NotFoundError = NotFoundError
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = Extensions.getExtensionContext
Prisma.defineExtension = Extensions.defineExtension

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */
exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.CarerScalarFieldEnum = {
  id: 'id',
  first_name: 'first_name',
  last_name: 'last_name',
  email: 'email',
  phone: 'phone',
  hire_date: 'hire_date',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  full_name: 'full_name',
  preferred_name: 'preferred_name',
  pronouns: 'pronouns',
  address_line1: 'address_line1',
  address_line2: 'address_line2',
  city: 'city',
  postcode: 'postcode',
  date_of_birth: 'date_of_birth',
  preferred_language: 'preferred_language',
  communication_needs: 'communication_needs',
  accessibility_adjustments: 'accessibility_adjustments',
  representative_name: 'representative_name',
  representative_relationship: 'representative_relationship',
  representative_phone: 'representative_phone',
  representative_email: 'representative_email',
  organization_id: 'organization_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.CarePlanScalarFieldEnum = {
  id: 'id',
  client_id: 'client_id',
  active_version_id: 'active_version_id',
  draft_version_id: 'draft_version_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.CarePlanVersionScalarFieldEnum = {
  id: 'id',
  care_plan_id: 'care_plan_id',
  version_number: 'version_number',
  status: 'status',
  review_due_at: 'review_due_at',
  effective_from: 'effective_from',
  authored_by: 'authored_by',
  approved_by: 'approved_by',
  approved_at: 'approved_at',
  content: 'content',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.VisitScalarFieldEnum = {
  id: 'id',
  carer_id: 'carer_id',
  client_id: 'client_id',
  scheduled_start: 'scheduled_start',
  scheduled_end: 'scheduled_end',
  actual_start: 'actual_start',
  actual_end: 'actual_end',
  status: 'status',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.VisitTaskScalarFieldEnum = {
  id: 'id',
  visit_id: 'visit_id',
  task_name: 'task_name',
  description: 'description',
  is_completed: 'is_completed',
  completed_at: 'completed_at',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.MedicationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  dosage: 'dosage',
  unit: 'unit',
  instructions: 'instructions',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.PrescriptionScalarFieldEnum = {
  id: 'id',
  client_id: 'client_id',
  medication_id: 'medication_id',
  start_date: 'start_date',
  end_date: 'end_date',
  frequency_per_day: 'frequency_per_day',
  frequency_interval_hours: 'frequency_interval_hours',
  administration_times: 'administration_times',
  special_instructions: 'special_instructions',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.MedicationAdministrationScalarFieldEnum = {
  id: 'id',
  prescription_id: 'prescription_id',
  visit_id: 'visit_id',
  scheduled_time: 'scheduled_time',
  administered_time: 'administered_time',
  administered_by: 'administered_by',
  status: 'status',
  notes: 'notes',
  instruction_snapshot: 'instruction_snapshot',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.MedicationAuditScalarFieldEnum = {
  id: 'id',
  prescription_id: 'prescription_id',
  medication_administration_id: 'medication_administration_id',
  action: 'action',
  actor_id: 'actor_id',
  actor_role: 'actor_role',
  changes: 'changes',
  timestamp: 'timestamp'
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  ai_summary_enabled: 'ai_summary_enabled',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.LogEmbeddingScalarFieldEnum = {
  id: 'id',
  visit_id: 'visit_id',
  log_type: 'log_type',
  log_timestamp: 'log_timestamp',
  raw_data: 'raw_data',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.HealthSummaryScalarFieldEnum = {
  id: 'id',
  client_id: 'client_id',
  period_start: 'period_start',
  period_end: 'period_end',
  summary_json: 'summary_json',
  risk_levels: 'risk_levels',
  generated_at: 'generated_at',
  generated_by: 'generated_by',
  approved_by: 'approved_by',
  approved_at: 'approved_at',
  feedback: 'feedback',
  expires_at: 'expires_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ConsentRecordScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  consent_type: 'consent_type',
  purpose: 'purpose',
  granted: 'granted',
  granted_at: 'granted_at',
  withdrawn_at: 'withdrawn_at',
  legal_basis: 'legal_basis',
  metadata: 'metadata',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  action: 'action',
  resource_type: 'resource_type',
  resource_id: 'resource_id',
  old_values: 'old_values',
  new_values: 'new_values',
  ip_address: 'ip_address',
  user_agent: 'user_agent',
  timestamp: 'timestamp'
};

exports.Prisma.RetentionPolicyScalarFieldEnum = {
  id: 'id',
  data_category: 'data_category',
  retention_days: 'retention_days',
  legal_basis: 'legal_basis',
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ErasureQueueScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  request_type: 'request_type',
  status: 'status',
  requested_at: 'requested_at',
  scheduled_for: 'scheduled_for',
  completed_at: 'completed_at',
  metadata: 'metadata',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.CarePlanStatus = exports.$Enums.CarePlanStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED'
};

exports.VisitStatus = exports.$Enums.VisitStatus = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

exports.MedicationStatus = exports.$Enums.MedicationStatus = {
  SCHEDULED: 'SCHEDULED',
  ADMINISTERED: 'ADMINISTERED',
  MISSED: 'MISSED',
  REFUSED: 'REFUSED',
  CANCELLED: 'CANCELLED'
};

exports.MedicationAuditAction = exports.$Enums.MedicationAuditAction = {
  PRESCRIPTION_CREATED: 'PRESCRIPTION_CREATED',
  PRESCRIPTION_UPDATED: 'PRESCRIPTION_UPDATED',
  PRESCRIPTION_DELETED: 'PRESCRIPTION_DELETED',
  MEDICATION_SCHEDULED: 'MEDICATION_SCHEDULED',
  MEDICATION_ADMINISTERED: 'MEDICATION_ADMINISTERED',
  MEDICATION_MISSED: 'MEDICATION_MISSED',
  MEDICATION_REFUSED: 'MEDICATION_REFUSED',
  MEDICATION_CANCELLED: 'MEDICATION_CANCELLED',
  AI_SUMMARY_GENERATED: 'AI_SUMMARY_GENERATED',
  AI_SUMMARY_APPROVED: 'AI_SUMMARY_APPROVED',
  AI_SUMMARY_REJECTED: 'AI_SUMMARY_REJECTED'
};

exports.Prisma.ModelName = {
  Carer: 'Carer',
  Client: 'Client',
  CarePlan: 'CarePlan',
  CarePlanVersion: 'CarePlanVersion',
  Visit: 'Visit',
  VisitTask: 'VisitTask',
  Medication: 'Medication',
  Prescription: 'Prescription',
  MedicationAdministration: 'MedicationAdministration',
  MedicationAudit: 'MedicationAudit',
  Organization: 'Organization',
  LogEmbedding: 'LogEmbedding',
  HealthSummary: 'HealthSummary',
  ConsentRecord: 'ConsentRecord',
  AuditLog: 'AuditLog',
  RetentionPolicy: 'RetentionPolicy',
  ErasureQueue: 'ErasureQueue'
};
/**
 * Create the Client
 */
const config = {
  "generator": {
    "name": "client",
    "provider": {
      "fromEnvVar": null,
      "value": "prisma-client-js"
    },
    "output": {
      "value": "/private/tmp/oasis-codex-impl-review/libs/db/src/generated/client",
      "fromEnvVar": null
    },
    "config": {
      "engineType": "library"
    },
    "binaryTargets": [
      {
        "fromEnvVar": null,
        "value": "darwin-arm64",
        "native": true
      },
      {
        "fromEnvVar": null,
        "value": "linux-musl-openssl-3.0.x"
      }
    ],
    "previewFeatures": [
      "postgresqlExtensions"
    ],
    "isCustomOutput": true
  },
  "relativeEnvPaths": {
    "rootEnvPath": null
  },
  "relativePath": "../../../prisma",
  "clientVersion": "5.8.0",
  "engineVersion": "0a83d8541752d7582de2ebc1ece46519ce72a848",
  "datasourceNames": [
    "db"
  ],
  "activeProvider": "postgresql",
  "postinstall": false,
  "inlineDatasources": {
    "db": {
      "url": {
        "fromEnvVar": "DATABASE_URL",
        "value": null
      }
    }
  },
  "inlineSchema": "ZGF0YXNvdXJjZSBkYiB7CiAgcHJvdmlkZXIgPSAicG9zdGdyZXNxbCIKICB1cmwgICAgICA9IGVudigiREFUQUJBU0VfVVJMIikKfQoKZ2VuZXJhdG9yIGNsaWVudCB7CiAgcHJvdmlkZXIgICAgICAgID0gInByaXNtYS1jbGllbnQtanMiCiAgb3V0cHV0ICAgICAgICAgID0gIi4uL3NyYy9nZW5lcmF0ZWQvY2xpZW50IgogIGVuZ2luZVR5cGUgICAgICA9ICJsaWJyYXJ5IgogIGJpbmFyeVRhcmdldHMgICA9IFsibmF0aXZlIiwgImxpbnV4LW11c2wtb3BlbnNzbC0zLjAueCJdCiAgcHJldmlld0ZlYXR1cmVzID0gWyJwb3N0Z3Jlc3FsRXh0ZW5zaW9ucyJdCn0KCm1vZGVsIENhcmVyIHsKICBpZCAgICAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgZmlyc3RfbmFtZSAgICAgICAgIFN0cmluZwogIGxhc3RfbmFtZSAgICAgICAgICBTdHJpbmcKICBlbWFpbCAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgIEB1bmlxdWUKICBwaG9uZSAgICAgICAgICAgICAgU3RyaW5nPwogIGhpcmVfZGF0ZSAgICAgICAgICBEYXRlVGltZSAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgaXNfYWN0aXZlICAgICAgICAgIEJvb2xlYW4gICAgICAgICBAZGVmYXVsdCh0cnVlKQogIHZpc2l0cyAgICAgICAgICAgICBWaXNpdFtdCiAgYXBwcm92ZWRfc3VtbWFyaWVzIEhlYWx0aFN1bW1hcnlbXQogIGNyZWF0ZWRfYXQgICAgICAgICBEYXRlVGltZSAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICAgIERhdGVUaW1lICAgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICAgICAgIERhdGVUaW1lPwoKICBAQG1hcCgiY2FyZXIiKQp9Cgptb2RlbCBDbGllbnQgewogIGlkICAgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgZnVsbF9uYW1lICAgICAgICAgICAgICAgICBTdHJpbmcKICBwcmVmZXJyZWRfbmFtZSAgICAgICAgICAgIFN0cmluZz8KICBwcm9ub3VucyAgICAgICAgICAgICAgICAgIFN0cmluZz8KICBhZGRyZXNzX2xpbmUxICAgICAgICAgICAgIFN0cmluZwogIGFkZHJlc3NfbGluZTIgICAgICAgICAgICAgU3RyaW5nPwogIGNpdHkgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nCiAgcG9zdGNvZGUgICAgICAgICAgICAgICAgICBTdHJpbmcKICBkYXRlX29mX2JpcnRoICAgICAgICAgICAgIERhdGVUaW1lPwogIHByZWZlcnJlZF9sYW5ndWFnZSAgICAgICAgU3RyaW5nPwogIGNvbW11bmljYXRpb25fbmVlZHMgICAgICAgU3RyaW5nPwogIGFjY2Vzc2liaWxpdHlfYWRqdXN0bWVudHMgU3RyaW5nPwogIHJlcHJlc2VudGF0aXZlX25hbWUgICAgICAgU3RyaW5nPwogIHJlcHJlc2VudGF0aXZlX3JlbGF0aW9uc2hpcCBTdHJpbmc/CiAgcmVwcmVzZW50YXRpdmVfcGhvbmUgICAgICBTdHJpbmc/CiAgcmVwcmVzZW50YXRpdmVfZW1haWwgICAgICBTdHJpbmc/CiAgb3JnYW5pemF0aW9uX2lkICAgICAgICAgICBTdHJpbmc/CiAgdmlzaXRzICAgICAgICAgICAgICAgICAgICBWaXNpdFtdCiAgcHJlc2NyaXB0aW9ucyAgICAgICAgICAgICBQcmVzY3JpcHRpb25bXQogIGNhcmVfcGxhbiAgICAgICAgICAgICAgICAgQ2FyZVBsYW4/CiAgb3JnYW5pemF0aW9uICAgICAgICAgICAgICBPcmdhbml6YXRpb24/ICAgQHJlbGF0aW9uKGZpZWxkczogW29yZ2FuaXphdGlvbl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgaGVhbHRoX3N1bW1hcmllcyAgICAgICAgICBIZWFsdGhTdW1tYXJ5W10KICBjcmVhdGVkX2F0ICAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICAgICAgICAgICAgICBEYXRlVGltZT8KCiAgQEBtYXAoImNsaWVudCIpCn0KCm1vZGVsIENhcmVQbGFuIHsKICBpZCAgICAgICAgICAgICAgICBTdHJpbmcgICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIGNsaWVudF9pZCAgICAgICAgIFN0cmluZyAgICAgICAgICAgIEB1bmlxdWUKICBhY3RpdmVfdmVyc2lvbl9pZCBTdHJpbmc/ICAgICAgICAgICBAdW5pcXVlCiAgZHJhZnRfdmVyc2lvbl9pZCAgU3RyaW5nPyAgICAgICAgICAgQHVuaXF1ZQogIGNsaWVudCAgICAgICAgICAgIENsaWVudCAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtjbGllbnRfaWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIGFjdGl2ZV92ZXJzaW9uICAgIENhcmVQbGFuVmVyc2lvbj8gIEByZWxhdGlvbigiY2FyZV9wbGFuX2FjdGl2ZV92ZXJzaW9uIiwgZmllbGRzOiBbYWN0aXZlX3ZlcnNpb25faWRdLCByZWZlcmVuY2VzOiBbaWRdLCBvbkRlbGV0ZTogU2V0TnVsbCwgb25VcGRhdGU6IE5vQWN0aW9uKQogIGRyYWZ0X3ZlcnNpb24gICAgIENhcmVQbGFuVmVyc2lvbj8gIEByZWxhdGlvbigiY2FyZV9wbGFuX2RyYWZ0X3ZlcnNpb24iLCBmaWVsZHM6IFtkcmFmdF92ZXJzaW9uX2lkXSwgcmVmZXJlbmNlczogW2lkXSwgb25EZWxldGU6IFNldE51bGwsIG9uVXBkYXRlOiBOb0FjdGlvbikKICB2ZXJzaW9ucyAgICAgICAgICBDYXJlUGxhblZlcnNpb25bXSBAcmVsYXRpb24oImNhcmVfcGxhbl92ZXJzaW9ucyIpCiAgY3JlYXRlZF9hdCAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgQHVwZGF0ZWRBdAogIGRlbGV0ZWRfYXQgICAgICAgIERhdGVUaW1lPwoKICBAQG1hcCgiY2FyZV9wbGFuIikKfQoKbW9kZWwgQ2FyZVBsYW5WZXJzaW9uIHsKICBpZCAgICAgICAgICAgICBTdHJpbmcgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIGNhcmVfcGxhbl9pZCAgIFN0cmluZwogIHZlcnNpb25fbnVtYmVyIEludAogIHN0YXR1cyAgICAgICAgIENhcmVQbGFuU3RhdHVzIEBkZWZhdWx0KERSQUZUKQogIHJldmlld19kdWVfYXQgIERhdGVUaW1lPwogIGVmZmVjdGl2ZV9mcm9tIERhdGVUaW1lPwogIGF1dGhvcmVkX2J5ICAgIFN0cmluZwogIGFwcHJvdmVkX2J5ICAgIFN0cmluZz8KICBhcHByb3ZlZF9hdCAgICBEYXRlVGltZT8KICBjb250ZW50ICAgICAgICBKc29uCiAgY2FyZV9wbGFuICAgICAgQ2FyZVBsYW4gICAgICAgQHJlbGF0aW9uKCJjYXJlX3BsYW5fdmVyc2lvbnMiLCBmaWVsZHM6IFtjYXJlX3BsYW5faWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIGFjdGl2ZV9mb3IgICAgIENhcmVQbGFuPyAgICAgIEByZWxhdGlvbigiY2FyZV9wbGFuX2FjdGl2ZV92ZXJzaW9uIikKICBkcmFmdF9mb3IgICAgICBDYXJlUGxhbj8gICAgICBAcmVsYXRpb24oImNhcmVfcGxhbl9kcmFmdF92ZXJzaW9uIikKICBjcmVhdGVkX2F0ICAgICBEYXRlVGltZSAgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICBEYXRlVGltZSAgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICAgRGF0ZVRpbWU/CgogIEBAdW5pcXVlKFtjYXJlX3BsYW5faWQsIHZlcnNpb25fbnVtYmVyXSkKICBAQGluZGV4KFtjYXJlX3BsYW5faWQsIHN0YXR1c10pCiAgQEBpbmRleChbYXBwcm92ZWRfYXRdKQogIEBAbWFwKCJjYXJlX3BsYW5fdmVyc2lvbiIpCn0KCmVudW0gQ2FyZVBsYW5TdGF0dXMgewogIERSQUZUCiAgQUNUSVZFCiAgU1VQRVJTRURFRAp9Cgptb2RlbCBWaXNpdCB7CiAgaWQgICAgICAgICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgICAgICAgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgY2FyZXJfaWQgICAgICAgICAgICAgICAgIFN0cmluZwogIGNsaWVudF9pZCAgICAgICAgICAgICAgICBTdHJpbmcKICBzY2hlZHVsZWRfc3RhcnQgICAgICAgICAgRGF0ZVRpbWUKICBzY2hlZHVsZWRfZW5kICAgICAgICAgICAgRGF0ZVRpbWUKICBhY3R1YWxfc3RhcnQgICAgICAgICAgICAgRGF0ZVRpbWU/CiAgYWN0dWFsX2VuZCAgICAgICAgICAgICAgIERhdGVUaW1lPwogIHN0YXR1cyAgICAgICAgICAgICAgICAgICBWaXNpdFN0YXR1cyAgICAgICAgICAgICAgICBAZGVmYXVsdChTQ0hFRFVMRUQpCiAgbm90ZXMgICAgICAgICAgICAgICAgICAgIFN0cmluZz8KICBjYXJlciAgICAgICAgICAgICAgICAgICAgQ2FyZXIgICAgICAgICAgICAgICAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NhcmVyX2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBjbGllbnQgICAgICAgICAgICAgICAgICAgQ2xpZW50ICAgICAgICAgICAgICAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NsaWVudF9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgdGFza3MgICAgICAgICAgICAgICAgICAgIFZpc2l0VGFza1tdCiAgbWVkaWNhdGlvbl9hZG1pbmlzdHJhdGlvbnMgTWVkaWNhdGlvbkFkbWluaXN0cmF0aW9uW10KICBsb2dfZW1iZWRkaW5ncyAgICAgICAgICAgTG9nRW1iZWRkaW5nW10KICBjcmVhdGVkX2F0ICAgICAgICAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgIEB1cGRhdGVkQXQKICBkZWxldGVkX2F0ICAgICAgICAgICAgICAgRGF0ZVRpbWU/CgogIEBAaW5kZXgoW2NhcmVyX2lkXSkKICBAQGluZGV4KFtjbGllbnRfaWRdKQogIEBAaW5kZXgoW3NjaGVkdWxlZF9zdGFydCwgc2NoZWR1bGVkX2VuZF0pCiAgQEBpbmRleChbY2FyZXJfaWQsIHNjaGVkdWxlZF9zdGFydCwgc2NoZWR1bGVkX2VuZF0pCiAgQEBpbmRleChbY3JlYXRlZF9hdF0pCiAgQEBpbmRleChbYWN0dWFsX2VuZF0pCiAgQEBtYXAoInZpc2l0IikKfQoKbW9kZWwgVmlzaXRUYXNrIHsKICBpZCAgICAgICAgICAgU3RyaW5nICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgdmlzaXRfaWQgICAgIFN0cmluZwogIHRhc2tfbmFtZSAgICBTdHJpbmcKICBkZXNjcmlwdGlvbiAgU3RyaW5nPwogIGlzX2NvbXBsZXRlZCBCb29sZWFuICAgQGRlZmF1bHQoZmFsc2UpCiAgY29tcGxldGVkX2F0IERhdGVUaW1lPwogIG5vdGVzICAgICAgICBTdHJpbmc/CiAgdmlzaXQgICAgICAgIFZpc2l0ICAgICBAcmVsYXRpb24oZmllbGRzOiBbdmlzaXRfaWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIGNyZWF0ZWRfYXQgICBEYXRlVGltZSAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgIERhdGVUaW1lICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgIERhdGVUaW1lPwoKICBAQGluZGV4KFt2aXNpdF9pZF0pCiAgQEBtYXAoInZpc2l0X3Rhc2siKQp9CgplbnVtIFZpc2l0U3RhdHVzIHsKICBTQ0hFRFVMRUQKICBJTl9QUk9HUkVTUwogIENPTVBMRVRFRAogIENBTkNFTExFRAp9Cgptb2RlbCBNZWRpY2F0aW9uIHsKICBpZCAgICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBuYW1lICAgICAgICAgIFN0cmluZwogIGRvc2FnZSAgICAgICAgU3RyaW5nCiAgdW5pdCAgICAgICAgICBTdHJpbmcKICBpbnN0cnVjdGlvbnMgIFN0cmluZz8KICBwcmVzY3JpcHRpb25zIFByZXNjcmlwdGlvbltdCiAgY3JlYXRlZF9hdCAgICBEYXRlVGltZSAgICAgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgRGF0ZVRpbWUgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICBEYXRlVGltZT8KCiAgQEBtYXAoIm1lZGljYXRpb24iKQp9Cgptb2RlbCBQcmVzY3JpcHRpb24gewogIGlkICAgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgICAgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBjbGllbnRfaWQgICAgICAgICAgICAgICAgIFN0cmluZwogIG1lZGljYXRpb25faWQgICAgICAgICAgICAgU3RyaW5nCiAgc3RhcnRfZGF0ZSAgICAgICAgICAgICAgICBEYXRlVGltZQogIGVuZF9kYXRlICAgICAgICAgICAgICAgICAgRGF0ZVRpbWU/CiAgZnJlcXVlbmN5X3Blcl9kYXkgICAgICAgICBJbnQKICBmcmVxdWVuY3lfaW50ZXJ2YWxfaG91cnMgIEludD8KICBhZG1pbmlzdHJhdGlvbl90aW1lcyAgICAgIFN0cmluZ1tdIC8vIEpTT04gYXJyYXkgb2YgdGltZXMgbGlrZSBbIjA4OjAwIiwgIjIwOjAwIl0KICBzcGVjaWFsX2luc3RydWN0aW9ucyAgICAgIFN0cmluZz8KICBpc19hY3RpdmUgICAgICAgICAgICAgICAgIEJvb2xlYW4gICAgICAgICAgICAgICAgICAgIEBkZWZhdWx0KHRydWUpCiAgY2xpZW50ICAgICAgICAgICAgICAgICAgICBDbGllbnQgICAgICAgICAgICAgICAgICAgICBAcmVsYXRpb24oZmllbGRzOiBbY2xpZW50X2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBtZWRpY2F0aW9uICAgICAgICAgICAgICAgIE1lZGljYXRpb24gICAgICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFttZWRpY2F0aW9uX2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBhZG1pbmlzdHJhdGlvbnMgICAgICAgICAgIE1lZGljYXRpb25BZG1pbmlzdHJhdGlvbltdCiAgYXVkaXRzICAgICAgICAgICAgICAgICAgICBNZWRpY2F0aW9uQXVkaXRbXQogIGNyZWF0ZWRfYXQgICAgICAgICAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICAgICAgICAgICBEYXRlVGltZSAgICAgICAgICAgICAgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICAgICAgICAgICAgICBEYXRlVGltZT8KCiAgQEBpbmRleChbY2xpZW50X2lkXSkKICBAQGluZGV4KFttZWRpY2F0aW9uX2lkXSkKICBAQGluZGV4KFtzdGFydF9kYXRlLCBlbmRfZGF0ZV0pCiAgQEBtYXAoInByZXNjcmlwdGlvbiIpCn0KCm1vZGVsIE1lZGljYXRpb25BZG1pbmlzdHJhdGlvbiB7CiAgaWQgICAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIHByZXNjcmlwdGlvbl9pZCAgIFN0cmluZwogIHZpc2l0X2lkICAgICAgICAgIFN0cmluZz8KICAvLyBBY3RpdmUgc2NoZWR1bGVkIHJvd3MgYXJlIGFkZGl0aW9uYWxseSBwcm90ZWN0ZWQgYnkgYSBwYXJ0aWFsIHVuaXF1ZSBpbmRleCBpbiBTUUwgbWlncmF0aW9uOgogIC8vIChwcmVzY3JpcHRpb25faWQsIHNjaGVkdWxlZF90aW1lKSBXSEVSRSBkZWxldGVkX2F0IElTIE5VTEwKICBzY2hlZHVsZWRfdGltZSAgICBEYXRlVGltZQogIGFkbWluaXN0ZXJlZF90aW1lIERhdGVUaW1lPwogIGFkbWluaXN0ZXJlZF9ieSAgIFN0cmluZz8KICBzdGF0dXMgICAgICAgICAgICBNZWRpY2F0aW9uU3RhdHVzICAgIEBkZWZhdWx0KFNDSEVEVUxFRCkKICBub3RlcyAgICAgICAgICAgICBTdHJpbmc/CiAgaW5zdHJ1Y3Rpb25fc25hcHNob3QgU3RyaW5nPwogIHByZXNjcmlwdGlvbiAgICAgIFByZXNjcmlwdGlvbiAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW3ByZXNjcmlwdGlvbl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgdmlzaXQgICAgICAgICAgICAgVmlzaXQ/ICAgICAgICAgICAgICBAcmVsYXRpb24oZmllbGRzOiBbdmlzaXRfaWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIGF1ZGl0cyAgICAgICAgICAgIE1lZGljYXRpb25BdWRpdFtdCiAgY3JlYXRlZF9hdCAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICAgICBEYXRlVGltZSAgICAgICAgICAgIEB1cGRhdGVkQXQKICBkZWxldGVkX2F0ICAgICAgICBEYXRlVGltZT8KCiAgQEBpbmRleChbcHJlc2NyaXB0aW9uX2lkXSkKICBAQGluZGV4KFt2aXNpdF9pZF0pCiAgQEBpbmRleChbc2NoZWR1bGVkX3RpbWVdKQogIEBAaW5kZXgoW3N0YXR1cywgc2NoZWR1bGVkX3RpbWVdKQogIEBAbWFwKCJtZWRpY2F0aW9uX2FkbWluaXN0cmF0aW9uIikKfQoKbW9kZWwgTWVkaWNhdGlvbkF1ZGl0IHsKICBpZCAgICAgICAgICAgICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgICAgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBwcmVzY3JpcHRpb25faWQgICAgICAgICAgICAgIFN0cmluZz8KICBtZWRpY2F0aW9uX2FkbWluaXN0cmF0aW9uX2lkIFN0cmluZz8KICBhY3Rpb24gICAgICAgICAgICAgICAgICAgICAgIE1lZGljYXRpb25BdWRpdEFjdGlvbgogIGFjdG9yX2lkICAgICAgICAgICAgICAgICAgICAgU3RyaW5nCiAgYWN0b3Jfcm9sZSAgICAgICAgICAgICAgICAgICBTdHJpbmcKICBjaGFuZ2VzICAgICAgICAgICAgICAgICAgICAgIFN0cmluZyAvLyBKU09OIG9iamVjdCBvZiB3aGF0IGNoYW5nZWQKICB0aW1lc3RhbXAgICAgICAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgcHJlc2NyaXB0aW9uICAgICAgICAgICAgICAgICBQcmVzY3JpcHRpb24/ICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtwcmVzY3JpcHRpb25faWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIG1lZGljYXRpb25fYWRtaW5pc3RyYXRpb24gICAgTWVkaWNhdGlvbkFkbWluaXN0cmF0aW9uPyBAcmVsYXRpb24oZmllbGRzOiBbbWVkaWNhdGlvbl9hZG1pbmlzdHJhdGlvbl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCgogIEBAaW5kZXgoW3ByZXNjcmlwdGlvbl9pZF0pCiAgQEBpbmRleChbbWVkaWNhdGlvbl9hZG1pbmlzdHJhdGlvbl9pZF0pCiAgQEBpbmRleChbdGltZXN0YW1wXSkKICBAQG1hcCgibWVkaWNhdGlvbl9hdWRpdCIpCn0KCmVudW0gTWVkaWNhdGlvblN0YXR1cyB7CiAgU0NIRURVTEVECiAgQURNSU5JU1RFUkVECiAgTUlTU0VECiAgUkVGVVNFRAogIENBTkNFTExFRAp9CgplbnVtIE1lZGljYXRpb25BdWRpdEFjdGlvbiB7CiAgUFJFU0NSSVBUSU9OX0NSRUFURUQKICBQUkVTQ1JJUFRJT05fVVBEQVRFRAogIFBSRVNDUklQVElPTl9ERUxFVEVECiAgTUVESUNBVElPTl9TQ0hFRFVMRUQKICBNRURJQ0FUSU9OX0FETUlOSVNURVJFRAogIE1FRElDQVRJT05fTUlTU0VECiAgTUVESUNBVElPTl9SRUZVU0VECiAgTUVESUNBVElPTl9DQU5DRUxMRUQKICBBSV9TVU1NQVJZX0dFTkVSQVRFRAogIEFJX1NVTU1BUllfQVBQUk9WRUQKICBBSV9TVU1NQVJZX1JFSkVDVEVECn0KCm1vZGVsIE9yZ2FuaXphdGlvbiB7CiAgaWQgICAgICAgICAgICAgICAgIFN0cmluZyAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgbmFtZSAgICAgICAgICAgICAgIFN0cmluZwogIGFpX3N1bW1hcnlfZW5hYmxlZCBCb29sZWFuICBAZGVmYXVsdChmYWxzZSkKICBjbGllbnRzICAgICAgICAgICAgQ2xpZW50W10KICBjcmVhdGVkX2F0ICAgICAgICAgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICAgIERhdGVUaW1lIEB1cGRhdGVkQXQKCiAgQEBtYXAoIm9yZ2FuaXphdGlvbiIpCn0KCm1vZGVsIExvZ0VtYmVkZGluZyB7CiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgICAgICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIHZpc2l0X2lkICAgICAgU3RyaW5nCiAgbG9nX3R5cGUgICAgICBTdHJpbmcgICAgICAgICAgICAgICAgICAgICBAZGIuVmFyQ2hhcig1MCkKICBsb2dfdGltZXN0YW1wIERhdGVUaW1lCiAgZW1iZWRkaW5nICAgICBVbnN1cHBvcnRlZCgidmVjdG9yKDc2OCkiKT8KICByYXdfZGF0YSAgICAgIEpzb24KICB2aXNpdCAgICAgICAgIFZpc2l0ICAgICAgICAgICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFt2aXNpdF9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgY3JlYXRlZF9hdCAgICBEYXRlVGltZSAgICAgICAgICAgICAgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgIEB1cGRhdGVkQXQKCiAgQEBpbmRleChbdmlzaXRfaWRdKQogIEBAaW5kZXgoW2xvZ190aW1lc3RhbXBdKQogIEBAbWFwKCJsb2dfZW1iZWRkaW5nIikKfQoKbW9kZWwgSGVhbHRoU3VtbWFyeSB7CiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBjbGllbnRfaWQgICAgIFN0cmluZwogIHBlcmlvZF9zdGFydCAgRGF0ZVRpbWUgIEBkYi5EYXRlCiAgcGVyaW9kX2VuZCAgICBEYXRlVGltZSAgQGRiLkRhdGUKICBzdW1tYXJ5X2pzb24gIEpzb24KICByaXNrX2xldmVscyAgIEpzb24KICBnZW5lcmF0ZWRfYXQgIERhdGVUaW1lCiAgZ2VuZXJhdGVkX2J5ICBTdHJpbmcgICAgQGRlZmF1bHQoImFpIikgQGRiLlZhckNoYXIoNTApCiAgYXBwcm92ZWRfYnkgICBTdHJpbmc/CiAgYXBwcm92ZWRfYXQgICBEYXRlVGltZT8KICBmZWVkYmFjayAgICAgIFN0cmluZz8gICBAZGIuVmFyQ2hhcigxMCkKICBleHBpcmVzX2F0ICAgIERhdGVUaW1lICBAZGVmYXVsdChkYmdlbmVyYXRlZCgiTk9XKCkgKyBJTlRFUlZBTCAnMjQgaG91cnMnIikpCiAgY2xpZW50ICAgICAgICBDbGllbnQgICAgQHJlbGF0aW9uKGZpZWxkczogW2NsaWVudF9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgYXBwcm92ZXIgICAgICBDYXJlcj8gICAgQHJlbGF0aW9uKGZpZWxkczogW2FwcHJvdmVkX2J5XSwgcmVmZXJlbmNlczogW2lkXSkKICBjcmVhdGVkX2F0ICAgIERhdGVUaW1lICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgIERhdGVUaW1lICBAdXBkYXRlZEF0CgogIEBAaW5kZXgoW2NsaWVudF9pZF0pCiAgQEBpbmRleChbcGVyaW9kX3N0YXJ0LCBwZXJpb2RfZW5kXSkKICBAQG1hcCgiaGVhbHRoX3N1bW1hcnkiKQp9Cgptb2RlbCBDb25zZW50UmVjb3JkIHsKICBpZCAgICAgICAgICAgICAgIFN0cmluZyAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgdXNlcl9pZCAgICAgICAgICBTdHJpbmcKICBjb25zZW50X3R5cGUgICAgIFN0cmluZyAgIEBkYi5WYXJDaGFyKDUwKQogIHB1cnBvc2UgICAgICAgICAgU3RyaW5nICAgQGRiLlZhckNoYXIoMTAwKQogIGdyYW50ZWQgICAgICAgICAgQm9vbGVhbgogIGdyYW50ZWRfYXQgICAgICAgRGF0ZVRpbWUKICB3aXRoZHJhd25fYXQgICAgIERhdGVUaW1lPwogIGxlZ2FsX2Jhc2lzICAgICAgU3RyaW5nICAgQGRiLlZhckNoYXIoNTApCiAgbWV0YWRhdGEgICAgICAgICBKc29uPwogIGNyZWF0ZWRfYXQgICAgICAgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICBEYXRlVGltZSBAdXBkYXRlZEF0CgogIEBAaW5kZXgoW3VzZXJfaWRdKQogIEBAaW5kZXgoW2NvbnNlbnRfdHlwZV0pCiAgQEBpbmRleChbZ3JhbnRlZF9hdF0pCiAgQEBtYXAoImNvbnNlbnRfcmVjb3JkIikKfQoKbW9kZWwgQXVkaXRMb2cgewogIGlkICAgICAgICAgICAgIFN0cmluZyAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgdXNlcl9pZCAgICAgICAgU3RyaW5nPwogIGFjdGlvbiAgICAgICAgIFN0cmluZyAgIEBkYi5WYXJDaGFyKDUwKQogIHJlc291cmNlX3R5cGUgIFN0cmluZyAgIEBkYi5WYXJDaGFyKDUwKQogIHJlc291cmNlX2lkICAgIFN0cmluZz8KICBvbGRfdmFsdWVzICAgICBKc29uPwogIG5ld192YWx1ZXMgICAgIEpzb24/CiAgaXBfYWRkcmVzcyAgICAgU3RyaW5nPyAgQGRiLlZhckNoYXIoNDUpCiAgdXNlcl9hZ2VudCAgICAgU3RyaW5nPyAgQGRiLlZhckNoYXIoNTAwKQogIHRpbWVzdGFtcCAgICAgIERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKQoKICBAQGluZGV4KFt1c2VyX2lkXSkKICBAQGluZGV4KFthY3Rpb25dKQogIEBAaW5kZXgoW3Jlc291cmNlX3R5cGUsIHJlc291cmNlX2lkXSkKICBAQGluZGV4KFt0aW1lc3RhbXBdKQogIEBAbWFwKCJhdWRpdF9sb2ciKQp9Cgptb2RlbCBSZXRlbnRpb25Qb2xpY3kgewogIGlkICAgICAgICAgICAgICBTdHJpbmcgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIGRhdGFfY2F0ZWdvcnkgICBTdHJpbmcgICBAZGIuVmFyQ2hhcig1MCkKICByZXRlbnRpb25fZGF5cyAgSW50CiAgbGVnYWxfYmFzaXMgICAgIFN0cmluZyAgIEBkYi5WYXJDaGFyKDEwMCkKICBkZXNjcmlwdGlvbiAgICAgU3RyaW5nPwogIGlzX2FjdGl2ZSAgICAgICBCb29sZWFuICBAZGVmYXVsdCh0cnVlKQogIGNyZWF0ZWRfYXQgICAgICBEYXRlVGltZSBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICAgRGF0ZVRpbWUgQHVwZGF0ZWRBdAoKICBAQGluZGV4KFtkYXRhX2NhdGVnb3J5XSkKICBAQGluZGV4KFtpc19hY3RpdmVdKQogIEBAbWFwKCJyZXRlbnRpb25fcG9saWN5IikKfQoKbW9kZWwgRXJhc3VyZVF1ZXVlIHsKICBpZCAgICAgICAgICAgICBTdHJpbmcgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIHVzZXJfaWQgICAgICAgIFN0cmluZwogIHJlcXVlc3RfdHlwZSAgIFN0cmluZyAgIEBkYi5WYXJDaGFyKDUwKQogIHN0YXR1cyAgICAgICAgIFN0cmluZyAgIEBkYi5WYXJDaGFyKDIwKSBAZGVmYXVsdCgiUEVORElORyIpCiAgcmVxdWVzdGVkX2F0ICAgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpCiAgc2NoZWR1bGVkX2ZvciAgRGF0ZVRpbWU/CiAgY29tcGxldGVkX2F0ICAgRGF0ZVRpbWU/CiAgbWV0YWRhdGEgICAgICAgSnNvbj8KICBjcmVhdGVkX2F0ICAgICBEYXRlVGltZSBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICBEYXRlVGltZSBAdXBkYXRlZEF0CgogIEBAaW5kZXgoW3VzZXJfaWRdKQogIEBAaW5kZXgoW3N0YXR1c10pCiAgQEBpbmRleChbc2NoZWR1bGVkX2Zvcl0pCiAgQEBtYXAoImVyYXN1cmVfcXVldWUiKQp9Cg==",
  "inlineSchemaHash": "8637be0f79ac4bd66ff55e69fe4a7c030bc2c0c3ae6b80ee85e4fdb3bda35be4",
  "noEngine": false
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"Carer\":{\"dbName\":\"carer\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"first_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"last_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"phone\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"hire_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"CarerToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_summaries\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"HealthSummary\",\"relationName\":\"CarerToHealthSummary\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Client\":{\"dbName\":\"client\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"full_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"preferred_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"pronouns\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"address_line1\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"address_line2\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"city\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"postcode\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"date_of_birth\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"preferred_language\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"communication_needs\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"accessibility_adjustments\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"representative_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"representative_relationship\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"representative_phone\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"representative_email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"ClientToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"ClientToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"care_plan\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CarePlan\",\"relationName\":\"CarePlanToClient\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organization\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Organization\",\"relationName\":\"ClientToOrganization\",\"relationFromFields\":[\"organization_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"health_summaries\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"HealthSummary\",\"relationName\":\"ClientToHealthSummary\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"CarePlan\":{\"dbName\":\"care_plan\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"active_version_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":true,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"draft_version_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":true,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"CarePlanToClient\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"active_version\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CarePlanVersion\",\"relationName\":\"care_plan_active_version\",\"relationFromFields\":[\"active_version_id\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"SetNull\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"draft_version\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CarePlanVersion\",\"relationName\":\"care_plan_draft_version\",\"relationFromFields\":[\"draft_version_id\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"SetNull\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"versions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CarePlanVersion\",\"relationName\":\"care_plan_versions\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"CarePlanVersion\":{\"dbName\":\"care_plan_version\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"care_plan_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"version_number\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"CarePlanStatus\",\"default\":\"DRAFT\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"review_due_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"effective_from\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"authored_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"content\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"care_plan\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CarePlan\",\"relationName\":\"care_plan_versions\",\"relationFromFields\":[\"care_plan_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"active_for\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CarePlan\",\"relationName\":\"care_plan_active_version\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"draft_for\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CarePlan\",\"relationName\":\"care_plan_draft_version\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[[\"care_plan_id\",\"version_number\"]],\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"care_plan_id\",\"version_number\"]}],\"isGenerated\":false},\"Visit\":{\"dbName\":\"visit\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"carer_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actual_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actual_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"VisitStatus\",\"default\":\"SCHEDULED\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"carer\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Carer\",\"relationName\":\"CarerToVisit\",\"relationFromFields\":[\"carer_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToVisit\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"tasks\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"VisitTask\",\"relationName\":\"VisitToVisitTask\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administrations\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"log_embeddings\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"LogEmbedding\",\"relationName\":\"LogEmbeddingToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"VisitTask\":{\"dbName\":\"visit_task\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"task_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_completed\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"completed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"VisitToVisitTask\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Medication\":{\"dbName\":\"medication\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"dosage\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"unit\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"instructions\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Prescription\":{\"dbName\":\"prescription\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"start_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"end_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"frequency_per_day\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"frequency_interval_hours\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administration_times\",\"kind\":\"scalar\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"special_instructions\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToPrescription\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Medication\",\"relationName\":\"MedicationToPrescription\",\"relationFromFields\":[\"medication_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administrations\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"audits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAudit\",\"relationName\":\"MedicationAuditToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"MedicationAdministration\":{\"dbName\":\"medication_administration\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_time\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administered_time\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administered_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"MedicationStatus\",\"default\":\"SCHEDULED\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"instruction_snapshot\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationAdministrationToPrescription\",\"relationFromFields\":[\"prescription_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"MedicationAdministrationToVisit\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"audits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAudit\",\"relationName\":\"MedicationAdministrationToMedicationAudit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"MedicationAudit\":{\"dbName\":\"medication_audit\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administration_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"action\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAuditAction\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actor_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actor_role\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"changes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationAuditToPrescription\",\"relationFromFields\":[\"prescription_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administration\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToMedicationAudit\",\"relationFromFields\":[\"medication_administration_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Organization\":{\"dbName\":\"organization\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"ai_summary_enabled\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"clients\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToOrganization\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"LogEmbedding\":{\"dbName\":\"log_embedding\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"log_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"log_timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"raw_data\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"LogEmbeddingToVisit\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"HealthSummary\":{\"dbName\":\"health_summary\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"period_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"period_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"summary_json\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"risk_levels\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"generated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"generated_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"ai\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"feedback\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"expires_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"NOW() + INTERVAL '24 hours'\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToHealthSummary\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approver\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Carer\",\"relationName\":\"CarerToHealthSummary\",\"relationFromFields\":[\"approved_by\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ConsentRecord\":{\"dbName\":\"consent_record\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"consent_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"purpose\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"granted\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Boolean\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"granted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"withdrawn_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"legal_basis\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"metadata\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"AuditLog\":{\"dbName\":\"audit_log\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"action\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"resource_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"resource_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"old_values\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"new_values\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"ip_address\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_agent\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"RetentionPolicy\":{\"dbName\":\"retention_policy\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"data_category\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"retention_days\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"legal_basis\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ErasureQueue\":{\"dbName\":\"erasure_queue\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"request_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"PENDING\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"requested_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_for\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"completed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"metadata\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false}},\"enums\":{\"CarePlanStatus\":{\"values\":[{\"name\":\"DRAFT\",\"dbName\":null},{\"name\":\"ACTIVE\",\"dbName\":null},{\"name\":\"SUPERSEDED\",\"dbName\":null}],\"dbName\":null},\"VisitStatus\":{\"values\":[{\"name\":\"SCHEDULED\",\"dbName\":null},{\"name\":\"IN_PROGRESS\",\"dbName\":null},{\"name\":\"COMPLETED\",\"dbName\":null},{\"name\":\"CANCELLED\",\"dbName\":null}],\"dbName\":null},\"MedicationStatus\":{\"values\":[{\"name\":\"SCHEDULED\",\"dbName\":null},{\"name\":\"ADMINISTERED\",\"dbName\":null},{\"name\":\"MISSED\",\"dbName\":null},{\"name\":\"REFUSED\",\"dbName\":null},{\"name\":\"CANCELLED\",\"dbName\":null}],\"dbName\":null},\"MedicationAuditAction\":{\"values\":[{\"name\":\"PRESCRIPTION_CREATED\",\"dbName\":null},{\"name\":\"PRESCRIPTION_UPDATED\",\"dbName\":null},{\"name\":\"PRESCRIPTION_DELETED\",\"dbName\":null},{\"name\":\"MEDICATION_SCHEDULED\",\"dbName\":null},{\"name\":\"MEDICATION_ADMINISTERED\",\"dbName\":null},{\"name\":\"MEDICATION_MISSED\",\"dbName\":null},{\"name\":\"MEDICATION_REFUSED\",\"dbName\":null},{\"name\":\"MEDICATION_CANCELLED\",\"dbName\":null},{\"name\":\"AI_SUMMARY_GENERATED\",\"dbName\":null},{\"name\":\"AI_SUMMARY_APPROVED\",\"dbName\":null},{\"name\":\"AI_SUMMARY_REJECTED\",\"dbName\":null}],\"dbName\":null}},\"types\":{}}")
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)
config.getQueryEngineWasmModule = undefined

config.injectableEdgeEnv = () => ({
  parsed: {
    DATABASE_URL: typeof globalThis !== 'undefined' && globalThis['DATABASE_URL'] || typeof process !== 'undefined' && process.env && process.env.DATABASE_URL || undefined
  }
})

if (typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined) {
  Debug.enable(typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined)
}

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)

