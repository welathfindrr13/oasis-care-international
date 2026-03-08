
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
  address_line1: 'address_line1',
  address_line2: 'address_line2',
  city: 'city',
  postcode: 'postcode',
  date_of_birth: 'date_of_birth',
  organization_id: 'organization_id',
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
      "value": "/private/tmp/oasis-staging-prisma-hotfix/libs/db/src/generated/client",
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
        "value": "linux-musl"
      },
      {
        "fromEnvVar": null,
        "value": "linux-musl-openssl-3.0.x"
      },
      {
        "fromEnvVar": null,
        "value": "debian-openssl-3.0.x"
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
  "inlineSchema": "ZGF0YXNvdXJjZSBkYiB7CiAgcHJvdmlkZXIgPSAicG9zdGdyZXNxbCIKICB1cmwgICAgICA9IGVudigiREFUQUJBU0VfVVJMIikKfQoKZ2VuZXJhdG9yIGNsaWVudCB7CiAgcHJvdmlkZXIgICAgICAgID0gInByaXNtYS1jbGllbnQtanMiCiAgb3V0cHV0ICAgICAgICAgID0gIi4uL3NyYy9nZW5lcmF0ZWQvY2xpZW50IgogIGVuZ2luZVR5cGUgICAgICA9ICJsaWJyYXJ5IgogIGJpbmFyeVRhcmdldHMgICA9IFsibmF0aXZlIiwgImxpbnV4LW11c2wiLCAibGludXgtbXVzbC1vcGVuc3NsLTMuMC54IiwgImRlYmlhbi1vcGVuc3NsLTMuMC54Il0KICBwcmV2aWV3RmVhdHVyZXMgPSBbInBvc3RncmVzcWxFeHRlbnNpb25zIl0KfQoKbW9kZWwgQ2FyZXIgewogIGlkICAgICAgICAgICAgICAgICBTdHJpbmcgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBmaXJzdF9uYW1lICAgICAgICAgU3RyaW5nCiAgbGFzdF9uYW1lICAgICAgICAgIFN0cmluZwogIGVtYWlsICAgICAgICAgICAgICBTdHJpbmcgICAgICAgICAgQHVuaXF1ZQogIHBob25lICAgICAgICAgICAgICBTdHJpbmc/CiAgaGlyZV9kYXRlICAgICAgICAgIERhdGVUaW1lICAgICAgICBAZGVmYXVsdChub3coKSkKICBpc19hY3RpdmUgICAgICAgICAgQm9vbGVhbiAgICAgICAgIEBkZWZhdWx0KHRydWUpCiAgdmlzaXRzICAgICAgICAgICAgIFZpc2l0W10KICBhcHByb3ZlZF9zdW1tYXJpZXMgSGVhbHRoU3VtbWFyeVtdCiAgY3JlYXRlZF9hdCAgICAgICAgIERhdGVUaW1lICAgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICAgICAgRGF0ZVRpbWUgICAgICAgIEB1cGRhdGVkQXQKICBkZWxldGVkX2F0ICAgICAgICAgRGF0ZVRpbWU/CgogIEBAbWFwKCJjYXJlciIpCn0KCm1vZGVsIENsaWVudCB7CiAgaWQgICAgICAgICAgICAgICBTdHJpbmcgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBmdWxsX25hbWUgICAgICAgIFN0cmluZwogIGFkZHJlc3NfbGluZTEgICAgU3RyaW5nCiAgYWRkcmVzc19saW5lMiAgICBTdHJpbmc/CiAgY2l0eSAgICAgICAgICAgICBTdHJpbmcKICBwb3N0Y29kZSAgICAgICAgIFN0cmluZwogIGRhdGVfb2ZfYmlydGggICAgRGF0ZVRpbWU/CiAgb3JnYW5pemF0aW9uX2lkICBTdHJpbmc/CiAgdmlzaXRzICAgICAgICAgICBWaXNpdFtdCiAgcHJlc2NyaXB0aW9ucyAgICBQcmVzY3JpcHRpb25bXQogIG9yZ2FuaXphdGlvbiAgICAgT3JnYW5pemF0aW9uPyAgIEByZWxhdGlvbihmaWVsZHM6IFtvcmdhbml6YXRpb25faWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIGhlYWx0aF9zdW1tYXJpZXMgSGVhbHRoU3VtbWFyeVtdCiAgY3JlYXRlZF9hdCAgICAgICBEYXRlVGltZSAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICBEYXRlVGltZSAgICAgICAgQHVwZGF0ZWRBdAogIGRlbGV0ZWRfYXQgICAgICAgRGF0ZVRpbWU/CgogIEBAbWFwKCJjbGllbnQiKQp9Cgptb2RlbCBWaXNpdCB7CiAgaWQgICAgICAgICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgICAgICAgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgY2FyZXJfaWQgICAgICAgICAgICAgICAgIFN0cmluZwogIGNsaWVudF9pZCAgICAgICAgICAgICAgICBTdHJpbmcKICBzY2hlZHVsZWRfc3RhcnQgICAgICAgICAgRGF0ZVRpbWUKICBzY2hlZHVsZWRfZW5kICAgICAgICAgICAgRGF0ZVRpbWUKICBhY3R1YWxfc3RhcnQgICAgICAgICAgICAgRGF0ZVRpbWU/CiAgYWN0dWFsX2VuZCAgICAgICAgICAgICAgIERhdGVUaW1lPwogIHN0YXR1cyAgICAgICAgICAgICAgICAgICBWaXNpdFN0YXR1cyAgICAgICAgICAgICAgICBAZGVmYXVsdChTQ0hFRFVMRUQpCiAgbm90ZXMgICAgICAgICAgICAgICAgICAgIFN0cmluZz8KICBjYXJlciAgICAgICAgICAgICAgICAgICAgQ2FyZXIgICAgICAgICAgICAgICAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NhcmVyX2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBjbGllbnQgICAgICAgICAgICAgICAgICAgQ2xpZW50ICAgICAgICAgICAgICAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NsaWVudF9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgdGFza3MgICAgICAgICAgICAgICAgICAgIFZpc2l0VGFza1tdCiAgbWVkaWNhdGlvbl9hZG1pbmlzdHJhdGlvbnMgTWVkaWNhdGlvbkFkbWluaXN0cmF0aW9uW10KICBsb2dfZW1iZWRkaW5ncyAgICAgICAgICAgTG9nRW1iZWRkaW5nW10KICBjcmVhdGVkX2F0ICAgICAgICAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgIEB1cGRhdGVkQXQKICBkZWxldGVkX2F0ICAgICAgICAgICAgICAgRGF0ZVRpbWU/CgogIEBAaW5kZXgoW2NhcmVyX2lkXSkKICBAQGluZGV4KFtjbGllbnRfaWRdKQogIEBAaW5kZXgoW3NjaGVkdWxlZF9zdGFydCwgc2NoZWR1bGVkX2VuZF0pCiAgQEBpbmRleChbY2FyZXJfaWQsIHNjaGVkdWxlZF9zdGFydCwgc2NoZWR1bGVkX2VuZF0pCiAgQEBpbmRleChbY3JlYXRlZF9hdF0pCiAgQEBpbmRleChbYWN0dWFsX2VuZF0pCiAgQEBtYXAoInZpc2l0IikKfQoKbW9kZWwgVmlzaXRUYXNrIHsKICBpZCAgICAgICAgICAgU3RyaW5nICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgdmlzaXRfaWQgICAgIFN0cmluZwogIHRhc2tfbmFtZSAgICBTdHJpbmcKICBkZXNjcmlwdGlvbiAgU3RyaW5nPwogIGlzX2NvbXBsZXRlZCBCb29sZWFuICAgQGRlZmF1bHQoZmFsc2UpCiAgY29tcGxldGVkX2F0IERhdGVUaW1lPwogIG5vdGVzICAgICAgICBTdHJpbmc/CiAgdmlzaXQgICAgICAgIFZpc2l0ICAgICBAcmVsYXRpb24oZmllbGRzOiBbdmlzaXRfaWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIGNyZWF0ZWRfYXQgICBEYXRlVGltZSAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgIERhdGVUaW1lICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgIERhdGVUaW1lPwoKICBAQGluZGV4KFt2aXNpdF9pZF0pCiAgQEBtYXAoInZpc2l0X3Rhc2siKQp9CgplbnVtIFZpc2l0U3RhdHVzIHsKICBTQ0hFRFVMRUQKICBJTl9QUk9HUkVTUwogIENPTVBMRVRFRAogIENBTkNFTExFRAp9Cgptb2RlbCBNZWRpY2F0aW9uIHsKICBpZCAgICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBuYW1lICAgICAgICAgIFN0cmluZwogIGRvc2FnZSAgICAgICAgU3RyaW5nCiAgdW5pdCAgICAgICAgICBTdHJpbmcKICBpbnN0cnVjdGlvbnMgIFN0cmluZz8KICBwcmVzY3JpcHRpb25zIFByZXNjcmlwdGlvbltdCiAgY3JlYXRlZF9hdCAgICBEYXRlVGltZSAgICAgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgRGF0ZVRpbWUgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICBEYXRlVGltZT8KCiAgQEBtYXAoIm1lZGljYXRpb24iKQp9Cgptb2RlbCBQcmVzY3JpcHRpb24gewogIGlkICAgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgICAgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBjbGllbnRfaWQgICAgICAgICAgICAgICAgIFN0cmluZwogIG1lZGljYXRpb25faWQgICAgICAgICAgICAgU3RyaW5nCiAgc3RhcnRfZGF0ZSAgICAgICAgICAgICAgICBEYXRlVGltZQogIGVuZF9kYXRlICAgICAgICAgICAgICAgICAgRGF0ZVRpbWU/CiAgZnJlcXVlbmN5X3Blcl9kYXkgICAgICAgICBJbnQKICBmcmVxdWVuY3lfaW50ZXJ2YWxfaG91cnMgIEludD8KICBhZG1pbmlzdHJhdGlvbl90aW1lcyAgICAgIFN0cmluZ1tdIC8vIEpTT04gYXJyYXkgb2YgdGltZXMgbGlrZSBbIjA4OjAwIiwgIjIwOjAwIl0KICBzcGVjaWFsX2luc3RydWN0aW9ucyAgICAgIFN0cmluZz8KICBpc19hY3RpdmUgICAgICAgICAgICAgICAgIEJvb2xlYW4gICAgICAgICAgICAgICAgICAgIEBkZWZhdWx0KHRydWUpCiAgY2xpZW50ICAgICAgICAgICAgICAgICAgICBDbGllbnQgICAgICAgICAgICAgICAgICAgICBAcmVsYXRpb24oZmllbGRzOiBbY2xpZW50X2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBtZWRpY2F0aW9uICAgICAgICAgICAgICAgIE1lZGljYXRpb24gICAgICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFttZWRpY2F0aW9uX2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBhZG1pbmlzdHJhdGlvbnMgICAgICAgICAgIE1lZGljYXRpb25BZG1pbmlzdHJhdGlvbltdCiAgYXVkaXRzICAgICAgICAgICAgICAgICAgICBNZWRpY2F0aW9uQXVkaXRbXQogIGNyZWF0ZWRfYXQgICAgICAgICAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICAgICAgICAgICAgICBEYXRlVGltZSAgICAgICAgICAgICAgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICAgICAgICAgICAgICBEYXRlVGltZT8KCiAgQEBpbmRleChbY2xpZW50X2lkXSkKICBAQGluZGV4KFttZWRpY2F0aW9uX2lkXSkKICBAQGluZGV4KFtzdGFydF9kYXRlLCBlbmRfZGF0ZV0pCiAgQEBtYXAoInByZXNjcmlwdGlvbiIpCn0KCm1vZGVsIE1lZGljYXRpb25BZG1pbmlzdHJhdGlvbiB7CiAgaWQgICAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIHByZXNjcmlwdGlvbl9pZCAgIFN0cmluZwogIHZpc2l0X2lkICAgICAgICAgIFN0cmluZz8KICBzY2hlZHVsZWRfdGltZSAgICBEYXRlVGltZQogIGFkbWluaXN0ZXJlZF90aW1lIERhdGVUaW1lPwogIGFkbWluaXN0ZXJlZF9ieSAgIFN0cmluZz8KICBzdGF0dXMgICAgICAgICAgICBNZWRpY2F0aW9uU3RhdHVzICAgIEBkZWZhdWx0KFNDSEVEVUxFRCkKICBub3RlcyAgICAgICAgICAgICBTdHJpbmc/CiAgcHJlc2NyaXB0aW9uICAgICAgUHJlc2NyaXB0aW9uICAgICAgICBAcmVsYXRpb24oZmllbGRzOiBbcHJlc2NyaXB0aW9uX2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICB2aXNpdCAgICAgICAgICAgICBWaXNpdD8gICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFt2aXNpdF9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgYXVkaXRzICAgICAgICAgICAgTWVkaWNhdGlvbkF1ZGl0W10KICBjcmVhdGVkX2F0ICAgICAgICBEYXRlVGltZSAgICAgICAgICAgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgICAgIERhdGVUaW1lICAgICAgICAgICAgQHVwZGF0ZWRBdAogIGRlbGV0ZWRfYXQgICAgICAgIERhdGVUaW1lPwoKICBAQGluZGV4KFtwcmVzY3JpcHRpb25faWRdKQogIEBAaW5kZXgoW3Zpc2l0X2lkXSkKICBAQGluZGV4KFtzY2hlZHVsZWRfdGltZV0pCiAgQEBpbmRleChbc3RhdHVzLCBzY2hlZHVsZWRfdGltZV0pCiAgQEBtYXAoIm1lZGljYXRpb25fYWRtaW5pc3RyYXRpb24iKQp9Cgptb2RlbCBNZWRpY2F0aW9uQXVkaXQgewogIGlkICAgICAgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nICAgICAgICAgICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIHByZXNjcmlwdGlvbl9pZCAgICAgICAgICAgICAgU3RyaW5nPwogIG1lZGljYXRpb25fYWRtaW5pc3RyYXRpb25faWQgU3RyaW5nPwogIGFjdGlvbiAgICAgICAgICAgICAgICAgICAgICAgTWVkaWNhdGlvbkF1ZGl0QWN0aW9uCiAgYWN0b3JfaWQgICAgICAgICAgICAgICAgICAgICBTdHJpbmcKICBhY3Rvcl9yb2xlICAgICAgICAgICAgICAgICAgIFN0cmluZwogIGNoYW5nZXMgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nIC8vIEpTT04gb2JqZWN0IG9mIHdoYXQgY2hhbmdlZAogIHRpbWVzdGFtcCAgICAgICAgICAgICAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICAgICAgICBAZGVmYXVsdChub3coKSkKICBwcmVzY3JpcHRpb24gICAgICAgICAgICAgICAgIFByZXNjcmlwdGlvbj8gICAgICAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW3ByZXNjcmlwdGlvbl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgbWVkaWNhdGlvbl9hZG1pbmlzdHJhdGlvbiAgICBNZWRpY2F0aW9uQWRtaW5pc3RyYXRpb24/IEByZWxhdGlvbihmaWVsZHM6IFttZWRpY2F0aW9uX2FkbWluaXN0cmF0aW9uX2lkXSwgcmVmZXJlbmNlczogW2lkXSkKCiAgQEBpbmRleChbcHJlc2NyaXB0aW9uX2lkXSkKICBAQGluZGV4KFttZWRpY2F0aW9uX2FkbWluaXN0cmF0aW9uX2lkXSkKICBAQGluZGV4KFt0aW1lc3RhbXBdKQogIEBAbWFwKCJtZWRpY2F0aW9uX2F1ZGl0IikKfQoKZW51bSBNZWRpY2F0aW9uU3RhdHVzIHsKICBTQ0hFRFVMRUQKICBBRE1JTklTVEVSRUQKICBNSVNTRUQKICBSRUZVU0VECiAgQ0FOQ0VMTEVECn0KCmVudW0gTWVkaWNhdGlvbkF1ZGl0QWN0aW9uIHsKICBQUkVTQ1JJUFRJT05fQ1JFQVRFRAogIFBSRVNDUklQVElPTl9VUERBVEVECiAgUFJFU0NSSVBUSU9OX0RFTEVURUQKICBNRURJQ0FUSU9OX1NDSEVEVUxFRAogIE1FRElDQVRJT05fQURNSU5JU1RFUkVECiAgTUVESUNBVElPTl9NSVNTRUQKICBNRURJQ0FUSU9OX1JFRlVTRUQKICBNRURJQ0FUSU9OX0NBTkNFTExFRAogIEFJX1NVTU1BUllfR0VORVJBVEVECiAgQUlfU1VNTUFSWV9BUFBST1ZFRAogIEFJX1NVTU1BUllfUkVKRUNURUQKfQoKbW9kZWwgT3JnYW5pemF0aW9uIHsKICBpZCAgICAgICAgICAgICAgICAgU3RyaW5nICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBuYW1lICAgICAgICAgICAgICAgU3RyaW5nCiAgYWlfc3VtbWFyeV9lbmFibGVkIEJvb2xlYW4gIEBkZWZhdWx0KGZhbHNlKQogIGNsaWVudHMgICAgICAgICAgICBDbGllbnRbXQogIGNyZWF0ZWRfYXQgICAgICAgICBEYXRlVGltZSBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICAgICAgRGF0ZVRpbWUgQHVwZGF0ZWRBdAoKICBAQG1hcCgib3JnYW5pemF0aW9uIikKfQoKbW9kZWwgTG9nRW1iZWRkaW5nIHsKICBpZCAgICAgICAgICAgIFN0cmluZyAgICAgICAgICAgICAgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgdmlzaXRfaWQgICAgICBTdHJpbmcKICBsb2dfdHlwZSAgICAgIFN0cmluZyAgICAgICAgICAgICAgICAgICAgIEBkYi5WYXJDaGFyKDUwKQogIGxvZ190aW1lc3RhbXAgRGF0ZVRpbWUKICBlbWJlZGRpbmcgICAgIFVuc3VwcG9ydGVkKCJ2ZWN0b3IoNzY4KSIpPwogIHJhd19kYXRhICAgICAgSnNvbgogIHZpc2l0ICAgICAgICAgVmlzaXQgICAgICAgICAgICAgICAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW3Zpc2l0X2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBjcmVhdGVkX2F0ICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgRGF0ZVRpbWUgICAgICAgICAgICAgICAgICAgQHVwZGF0ZWRBdAoKICBAQGluZGV4KFt2aXNpdF9pZF0pCiAgQEBpbmRleChbbG9nX3RpbWVzdGFtcF0pCiAgQEBtYXAoImxvZ19lbWJlZGRpbmciKQp9Cgptb2RlbCBIZWFsdGhTdW1tYXJ5IHsKICBpZCAgICAgICAgICAgIFN0cmluZyAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIGNsaWVudF9pZCAgICAgU3RyaW5nCiAgcGVyaW9kX3N0YXJ0ICBEYXRlVGltZSAgQGRiLkRhdGUKICBwZXJpb2RfZW5kICAgIERhdGVUaW1lICBAZGIuRGF0ZQogIHN1bW1hcnlfanNvbiAgSnNvbgogIHJpc2tfbGV2ZWxzICAgSnNvbgogIGdlbmVyYXRlZF9hdCAgRGF0ZVRpbWUKICBnZW5lcmF0ZWRfYnkgIFN0cmluZyAgICBAZGVmYXVsdCgiYWkiKSBAZGIuVmFyQ2hhcig1MCkKICBhcHByb3ZlZF9ieSAgIFN0cmluZz8KICBhcHByb3ZlZF9hdCAgIERhdGVUaW1lPwogIGZlZWRiYWNrICAgICAgU3RyaW5nPyAgIEBkYi5WYXJDaGFyKDEwKQogIGV4cGlyZXNfYXQgICAgRGF0ZVRpbWUgIEBkZWZhdWx0KGRiZ2VuZXJhdGVkKCJOT1coKSArIElOVEVSVkFMICcyNCBob3VycyciKSkKICBjbGllbnQgICAgICAgIENsaWVudCAgICBAcmVsYXRpb24oZmllbGRzOiBbY2xpZW50X2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBhcHByb3ZlciAgICAgIENhcmVyPyAgICBAcmVsYXRpb24oZmllbGRzOiBbYXBwcm92ZWRfYnldLCByZWZlcmVuY2VzOiBbaWRdKQogIGNyZWF0ZWRfYXQgICAgRGF0ZVRpbWUgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgRGF0ZVRpbWUgIEB1cGRhdGVkQXQKCiAgQEBpbmRleChbY2xpZW50X2lkXSkKICBAQGluZGV4KFtwZXJpb2Rfc3RhcnQsIHBlcmlvZF9lbmRdKQogIEBAbWFwKCJoZWFsdGhfc3VtbWFyeSIpCn0KCm1vZGVsIENvbnNlbnRSZWNvcmQgewogIGlkICAgICAgICAgICAgICAgU3RyaW5nICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICB1c2VyX2lkICAgICAgICAgIFN0cmluZwogIGNvbnNlbnRfdHlwZSAgICAgU3RyaW5nICAgQGRiLlZhckNoYXIoNTApCiAgcHVycG9zZSAgICAgICAgICBTdHJpbmcgICBAZGIuVmFyQ2hhcigxMDApCiAgZ3JhbnRlZCAgICAgICAgICBCb29sZWFuCiAgZ3JhbnRlZF9hdCAgICAgICBEYXRlVGltZQogIHdpdGhkcmF3bl9hdCAgICAgRGF0ZVRpbWU/CiAgbGVnYWxfYmFzaXMgICAgICBTdHJpbmcgICBAZGIuVmFyQ2hhcig1MCkKICBtZXRhZGF0YSAgICAgICAgIEpzb24/CiAgY3JlYXRlZF9hdCAgICAgICBEYXRlVGltZSBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICAgIERhdGVUaW1lIEB1cGRhdGVkQXQKCiAgQEBpbmRleChbdXNlcl9pZF0pCiAgQEBpbmRleChbY29uc2VudF90eXBlXSkKICBAQGluZGV4KFtncmFudGVkX2F0XSkKICBAQG1hcCgiY29uc2VudF9yZWNvcmQiKQp9Cgptb2RlbCBBdWRpdExvZyB7CiAgaWQgICAgICAgICAgICAgU3RyaW5nICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICB1c2VyX2lkICAgICAgICBTdHJpbmc/CiAgYWN0aW9uICAgICAgICAgU3RyaW5nICAgQGRiLlZhckNoYXIoNTApCiAgcmVzb3VyY2VfdHlwZSAgU3RyaW5nICAgQGRiLlZhckNoYXIoNTApCiAgcmVzb3VyY2VfaWQgICAgU3RyaW5nPwogIG9sZF92YWx1ZXMgICAgIEpzb24/CiAgbmV3X3ZhbHVlcyAgICAgSnNvbj8KICBpcF9hZGRyZXNzICAgICBTdHJpbmc/ICBAZGIuVmFyQ2hhcig0NSkKICB1c2VyX2FnZW50ICAgICBTdHJpbmc/ICBAZGIuVmFyQ2hhcig1MDApCiAgdGltZXN0YW1wICAgICAgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpCgogIEBAaW5kZXgoW3VzZXJfaWRdKQogIEBAaW5kZXgoW2FjdGlvbl0pCiAgQEBpbmRleChbcmVzb3VyY2VfdHlwZSwgcmVzb3VyY2VfaWRdKQogIEBAaW5kZXgoW3RpbWVzdGFtcF0pCiAgQEBtYXAoImF1ZGl0X2xvZyIpCn0KCm1vZGVsIFJldGVudGlvblBvbGljeSB7CiAgaWQgICAgICAgICAgICAgIFN0cmluZyAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgZGF0YV9jYXRlZ29yeSAgIFN0cmluZyAgIEBkYi5WYXJDaGFyKDUwKQogIHJldGVudGlvbl9kYXlzICBJbnQKICBsZWdhbF9iYXNpcyAgICAgU3RyaW5nICAgQGRiLlZhckNoYXIoMTAwKQogIGRlc2NyaXB0aW9uICAgICBTdHJpbmc/CiAgaXNfYWN0aXZlICAgICAgIEJvb2xlYW4gIEBkZWZhdWx0KHRydWUpCiAgY3JlYXRlZF9hdCAgICAgIERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgICBEYXRlVGltZSBAdXBkYXRlZEF0CgogIEBAaW5kZXgoW2RhdGFfY2F0ZWdvcnldKQogIEBAaW5kZXgoW2lzX2FjdGl2ZV0pCiAgQEBtYXAoInJldGVudGlvbl9wb2xpY3kiKQp9Cgptb2RlbCBFcmFzdXJlUXVldWUgewogIGlkICAgICAgICAgICAgIFN0cmluZyAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgdXNlcl9pZCAgICAgICAgU3RyaW5nCiAgcmVxdWVzdF90eXBlICAgU3RyaW5nICAgQGRiLlZhckNoYXIoNTApCiAgc3RhdHVzICAgICAgICAgU3RyaW5nICAgQGRiLlZhckNoYXIoMjApIEBkZWZhdWx0KCJQRU5ESU5HIikKICByZXF1ZXN0ZWRfYXQgICBEYXRlVGltZSBAZGVmYXVsdChub3coKSkKICBzY2hlZHVsZWRfZm9yICBEYXRlVGltZT8KICBjb21wbGV0ZWRfYXQgICBEYXRlVGltZT8KICBtZXRhZGF0YSAgICAgICBKc29uPwogIGNyZWF0ZWRfYXQgICAgIERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgIERhdGVUaW1lIEB1cGRhdGVkQXQKCiAgQEBpbmRleChbdXNlcl9pZF0pCiAgQEBpbmRleChbc3RhdHVzXSkKICBAQGluZGV4KFtzY2hlZHVsZWRfZm9yXSkKICBAQG1hcCgiZXJhc3VyZV9xdWV1ZSIpCn0K",
  "inlineSchemaHash": "3ae32763e93cf9c78b76821bd4038c2380f299c0470c0d67b32474a322524cae",
  "noEngine": false
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"Carer\":{\"dbName\":\"carer\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"first_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"last_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"phone\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"hire_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"CarerToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_summaries\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"HealthSummary\",\"relationName\":\"CarerToHealthSummary\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Client\":{\"dbName\":\"client\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"full_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"address_line1\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"address_line2\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"city\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"postcode\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"date_of_birth\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"ClientToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"ClientToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organization\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Organization\",\"relationName\":\"ClientToOrganization\",\"relationFromFields\":[\"organization_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"health_summaries\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"HealthSummary\",\"relationName\":\"ClientToHealthSummary\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Visit\":{\"dbName\":\"visit\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"carer_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actual_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actual_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"VisitStatus\",\"default\":\"SCHEDULED\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"carer\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Carer\",\"relationName\":\"CarerToVisit\",\"relationFromFields\":[\"carer_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToVisit\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"tasks\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"VisitTask\",\"relationName\":\"VisitToVisitTask\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administrations\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"log_embeddings\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"LogEmbedding\",\"relationName\":\"LogEmbeddingToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"VisitTask\":{\"dbName\":\"visit_task\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"task_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_completed\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"completed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"VisitToVisitTask\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Medication\":{\"dbName\":\"medication\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"dosage\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"unit\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"instructions\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Prescription\":{\"dbName\":\"prescription\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"start_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"end_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"frequency_per_day\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"frequency_interval_hours\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administration_times\",\"kind\":\"scalar\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"special_instructions\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToPrescription\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Medication\",\"relationName\":\"MedicationToPrescription\",\"relationFromFields\":[\"medication_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administrations\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"audits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAudit\",\"relationName\":\"MedicationAuditToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"MedicationAdministration\":{\"dbName\":\"medication_administration\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_time\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administered_time\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administered_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"MedicationStatus\",\"default\":\"SCHEDULED\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationAdministrationToPrescription\",\"relationFromFields\":[\"prescription_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"MedicationAdministrationToVisit\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"audits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAudit\",\"relationName\":\"MedicationAdministrationToMedicationAudit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"MedicationAudit\":{\"dbName\":\"medication_audit\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administration_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"action\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAuditAction\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actor_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actor_role\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"changes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationAuditToPrescription\",\"relationFromFields\":[\"prescription_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administration\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToMedicationAudit\",\"relationFromFields\":[\"medication_administration_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Organization\":{\"dbName\":\"organization\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"ai_summary_enabled\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"clients\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToOrganization\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"LogEmbedding\":{\"dbName\":\"log_embedding\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"log_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"log_timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"raw_data\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"LogEmbeddingToVisit\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"HealthSummary\":{\"dbName\":\"health_summary\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"period_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"period_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"summary_json\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"risk_levels\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"generated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"generated_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"ai\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approved_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"feedback\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"expires_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"NOW() + INTERVAL '24 hours'\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToHealthSummary\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approver\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Carer\",\"relationName\":\"CarerToHealthSummary\",\"relationFromFields\":[\"approved_by\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ConsentRecord\":{\"dbName\":\"consent_record\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"consent_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"purpose\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"granted\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Boolean\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"granted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"withdrawn_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"legal_basis\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"metadata\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"AuditLog\":{\"dbName\":\"audit_log\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"action\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"resource_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"resource_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"old_values\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"new_values\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"ip_address\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_agent\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"RetentionPolicy\":{\"dbName\":\"retention_policy\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"data_category\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"retention_days\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"legal_basis\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ErasureQueue\":{\"dbName\":\"erasure_queue\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"request_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"PENDING\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"requested_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_for\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"completed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"metadata\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false}},\"enums\":{\"VisitStatus\":{\"values\":[{\"name\":\"SCHEDULED\",\"dbName\":null},{\"name\":\"IN_PROGRESS\",\"dbName\":null},{\"name\":\"COMPLETED\",\"dbName\":null},{\"name\":\"CANCELLED\",\"dbName\":null}],\"dbName\":null},\"MedicationStatus\":{\"values\":[{\"name\":\"SCHEDULED\",\"dbName\":null},{\"name\":\"ADMINISTERED\",\"dbName\":null},{\"name\":\"MISSED\",\"dbName\":null},{\"name\":\"REFUSED\",\"dbName\":null},{\"name\":\"CANCELLED\",\"dbName\":null}],\"dbName\":null},\"MedicationAuditAction\":{\"values\":[{\"name\":\"PRESCRIPTION_CREATED\",\"dbName\":null},{\"name\":\"PRESCRIPTION_UPDATED\",\"dbName\":null},{\"name\":\"PRESCRIPTION_DELETED\",\"dbName\":null},{\"name\":\"MEDICATION_SCHEDULED\",\"dbName\":null},{\"name\":\"MEDICATION_ADMINISTERED\",\"dbName\":null},{\"name\":\"MEDICATION_MISSED\",\"dbName\":null},{\"name\":\"MEDICATION_REFUSED\",\"dbName\":null},{\"name\":\"MEDICATION_CANCELLED\",\"dbName\":null},{\"name\":\"AI_SUMMARY_GENERATED\",\"dbName\":null},{\"name\":\"AI_SUMMARY_APPROVED\",\"dbName\":null},{\"name\":\"AI_SUMMARY_REJECTED\",\"dbName\":null}],\"dbName\":null}},\"types\":{}}")
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

