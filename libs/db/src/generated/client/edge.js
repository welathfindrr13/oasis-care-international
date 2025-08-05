
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

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
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
  MEDICATION_CANCELLED: 'MEDICATION_CANCELLED'
};

exports.Prisma.ModelName = {
  Carer: 'Carer',
  Client: 'Client',
  Visit: 'Visit',
  VisitTask: 'VisitTask',
  Medication: 'Medication',
  Prescription: 'Prescription',
  MedicationAdministration: 'MedicationAdministration',
  MedicationAudit: 'MedicationAudit'
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
      "value": "/Users/tyreeseedwards/oasis international care/libs/db/src/generated/client",
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
      }
    ],
    "previewFeatures": [
      "postgresqlExtensions"
    ],
    "isCustomOutput": true
  },
  "relativeEnvPaths": {
    "rootEnvPath": "../../../.env",
    "schemaEnvPath": "../../../.env"
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
  "inlineSchema": "ZGF0YXNvdXJjZSBkYiB7CiAgcHJvdmlkZXIgPSAicG9zdGdyZXNxbCIKICB1cmwgICAgICA9IGVudigiREFUQUJBU0VfVVJMIikKfQoKZ2VuZXJhdG9yIGNsaWVudCB7CiAgcHJvdmlkZXIgICAgICAgID0gInByaXNtYS1jbGllbnQtanMiCiAgb3V0cHV0ICAgICAgICAgID0gIi4uL3NyYy9nZW5lcmF0ZWQvY2xpZW50IgogIHByZXZpZXdGZWF0dXJlcyA9IFsicG9zdGdyZXNxbEV4dGVuc2lvbnMiXQp9Cgptb2RlbCBDYXJlciB7CiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBmaXJzdF9uYW1lICAgIFN0cmluZwogIGxhc3RfbmFtZSAgICAgU3RyaW5nCiAgZW1haWwgICAgICAgICBTdHJpbmcgICAgQHVuaXF1ZQogIHBob25lICAgICAgICAgU3RyaW5nPwogIGhpcmVfZGF0ZSAgICAgRGF0ZVRpbWUgIEBkZWZhdWx0KG5vdygpKQogIGlzX2FjdGl2ZSAgICAgQm9vbGVhbiAgIEBkZWZhdWx0KHRydWUpCiAgdmlzaXRzICAgICAgICBWaXNpdFtdCiAgY3JlYXRlZF9hdCAgICBEYXRlVGltZSAgQGRlZmF1bHQobm93KCkpCiAgdXBkYXRlZF9hdCAgICBEYXRlVGltZSAgQHVwZGF0ZWRBdAogIGRlbGV0ZWRfYXQgICAgRGF0ZVRpbWU/CgogIEBAbWFwKCJjYXJlciIpCn0KCm1vZGVsIENsaWVudCB7CiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIGZ1bGxfbmFtZSAgICAgU3RyaW5nCiAgYWRkcmVzc19saW5lMSBTdHJpbmcKICBhZGRyZXNzX2xpbmUyIFN0cmluZz8KICBjaXR5ICAgICAgICAgIFN0cmluZwogIHBvc3Rjb2RlICAgICAgU3RyaW5nCiAgZGF0ZV9vZl9iaXJ0aCBEYXRlVGltZT8KICB2aXNpdHMgICAgICAgIFZpc2l0W10KICBwcmVzY3JpcHRpb25zIFByZXNjcmlwdGlvbltdCiAgY3JlYXRlZF9hdCAgICBEYXRlVGltZSAgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgIERhdGVUaW1lICAgICAgIEB1cGRhdGVkQXQKICBkZWxldGVkX2F0ICAgIERhdGVUaW1lPwoKICBAQG1hcCgiY2xpZW50IikKfQoKbW9kZWwgVmlzaXQgewogIGlkICAgICAgICAgICAgICAgICAgICAgICBTdHJpbmcgICAgICAgICAgICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIGNhcmVyX2lkICAgICAgICAgICAgICAgICBTdHJpbmcKICBjbGllbnRfaWQgICAgICAgICAgICAgICAgU3RyaW5nCiAgc2NoZWR1bGVkX3N0YXJ0ICAgICAgICAgIERhdGVUaW1lCiAgc2NoZWR1bGVkX2VuZCAgICAgICAgICAgIERhdGVUaW1lCiAgYWN0dWFsX3N0YXJ0ICAgICAgICAgICAgIERhdGVUaW1lPwogIGFjdHVhbF9lbmQgICAgICAgICAgICAgICBEYXRlVGltZT8KICBzdGF0dXMgICAgICAgICAgICAgICAgICAgVmlzaXRTdGF0dXMgICAgICAgICAgICAgICAgQGRlZmF1bHQoU0NIRURVTEVEKQogIG5vdGVzICAgICAgICAgICAgICAgICAgICBTdHJpbmc/CiAgY2FyZXIgICAgICAgICAgICAgICAgICAgIENhcmVyICAgICAgICAgICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtjYXJlcl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgY2xpZW50ICAgICAgICAgICAgICAgICAgIENsaWVudCAgICAgICAgICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtjbGllbnRfaWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIHRhc2tzICAgICAgICAgICAgICAgICAgICBWaXNpdFRhc2tbXQogIG1lZGljYXRpb25fYWRtaW5pc3RyYXRpb25zIE1lZGljYXRpb25BZG1pbmlzdHJhdGlvbltdCiAgY3JlYXRlZF9hdCAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgICAgICAgICAgICBEYXRlVGltZSAgICAgICAgICAgICAgICAgICBAdXBkYXRlZEF0CiAgZGVsZXRlZF9hdCAgICAgICAgICAgICAgIERhdGVUaW1lPwoKICBAQGluZGV4KFtjYXJlcl9pZF0pCiAgQEBpbmRleChbY2xpZW50X2lkXSkKICBAQGluZGV4KFtzY2hlZHVsZWRfc3RhcnQsIHNjaGVkdWxlZF9lbmRdKQogIEBAaW5kZXgoW2NhcmVyX2lkLCBzY2hlZHVsZWRfc3RhcnQsIHNjaGVkdWxlZF9lbmRdKQogIEBAbWFwKCJ2aXNpdCIpCn0KCm1vZGVsIFZpc2l0VGFzayB7CiAgaWQgICAgICAgICAgIFN0cmluZyAgICBAaWQgQGRlZmF1bHQodXVpZCgpKQogIHZpc2l0X2lkICAgICBTdHJpbmcKICB0YXNrX25hbWUgICAgU3RyaW5nCiAgZGVzY3JpcHRpb24gIFN0cmluZz8KICBpc19jb21wbGV0ZWQgQm9vbGVhbiAgIEBkZWZhdWx0KGZhbHNlKQogIGNvbXBsZXRlZF9hdCBEYXRlVGltZT8KICBub3RlcyAgICAgICAgU3RyaW5nPwogIHZpc2l0ICAgICAgICBWaXNpdCAgICAgQHJlbGF0aW9uKGZpZWxkczogW3Zpc2l0X2lkXSwgcmVmZXJlbmNlczogW2lkXSkKICBjcmVhdGVkX2F0ICAgRGF0ZVRpbWUgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICBEYXRlVGltZSAgQHVwZGF0ZWRBdAogIGRlbGV0ZWRfYXQgICBEYXRlVGltZT8KCiAgQEBpbmRleChbdmlzaXRfaWRdKQogIEBAbWFwKCJ2aXNpdF90YXNrIikKfQoKZW51bSBWaXNpdFN0YXR1cyB7CiAgU0NIRURVTEVECiAgSU5fUFJPR1JFU1MKICBDT01QTEVURUQKICBDQU5DRUxMRUQKfQoKbW9kZWwgTWVkaWNhdGlvbiB7CiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgbmFtZSAgICAgICAgICBTdHJpbmcKICBkb3NhZ2UgICAgICAgIFN0cmluZwogIHVuaXQgICAgICAgICAgU3RyaW5nCiAgaW5zdHJ1Y3Rpb25zICBTdHJpbmc/CiAgcHJlc2NyaXB0aW9ucyBQcmVzY3JpcHRpb25bXQogIGNyZWF0ZWRfYXQgICAgRGF0ZVRpbWUgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgIERhdGVUaW1lICAgICAgQHVwZGF0ZWRBdAogIGRlbGV0ZWRfYXQgICAgRGF0ZVRpbWU/CgogIEBAbWFwKCJtZWRpY2F0aW9uIikKfQoKbW9kZWwgUHJlc2NyaXB0aW9uIHsKICBpZCAgICAgICAgICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgICAgICAgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpCiAgY2xpZW50X2lkICAgICAgICAgICAgICAgICBTdHJpbmcKICBtZWRpY2F0aW9uX2lkICAgICAgICAgICAgIFN0cmluZwogIHN0YXJ0X2RhdGUgICAgICAgICAgICAgICAgRGF0ZVRpbWUKICBlbmRfZGF0ZSAgICAgICAgICAgICAgICAgIERhdGVUaW1lPwogIGZyZXF1ZW5jeV9wZXJfZGF5ICAgICAgICAgSW50CiAgZnJlcXVlbmN5X2ludGVydmFsX2hvdXJzICBJbnQ/CiAgYWRtaW5pc3RyYXRpb25fdGltZXMgICAgICBTdHJpbmdbXSAvLyBKU09OIGFycmF5IG9mIHRpbWVzIGxpa2UgWyIwODowMCIsICIyMDowMCJdCiAgc3BlY2lhbF9pbnN0cnVjdGlvbnMgICAgICBTdHJpbmc/CiAgaXNfYWN0aXZlICAgICAgICAgICAgICAgICBCb29sZWFuICAgICAgICAgICAgICAgICAgICBAZGVmYXVsdCh0cnVlKQogIGNsaWVudCAgICAgICAgICAgICAgICAgICAgQ2xpZW50ICAgICAgICAgICAgICAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NsaWVudF9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgbWVkaWNhdGlvbiAgICAgICAgICAgICAgICBNZWRpY2F0aW9uICAgICAgICAgICAgICAgICBAcmVsYXRpb24oZmllbGRzOiBbbWVkaWNhdGlvbl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgYWRtaW5pc3RyYXRpb25zICAgICAgICAgICBNZWRpY2F0aW9uQWRtaW5pc3RyYXRpb25bXQogIGF1ZGl0cyAgICAgICAgICAgICAgICAgICAgTWVkaWNhdGlvbkF1ZGl0W10KICBjcmVhdGVkX2F0ICAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgIEBkZWZhdWx0KG5vdygpKQogIHVwZGF0ZWRfYXQgICAgICAgICAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICAgICAgICAgQHVwZGF0ZWRBdAogIGRlbGV0ZWRfYXQgICAgICAgICAgICAgICAgRGF0ZVRpbWU/CgogIEBAaW5kZXgoW2NsaWVudF9pZF0pCiAgQEBpbmRleChbbWVkaWNhdGlvbl9pZF0pCiAgQEBpbmRleChbc3RhcnRfZGF0ZSwgZW5kX2RhdGVdKQogIEBAbWFwKCJwcmVzY3JpcHRpb24iKQp9Cgptb2RlbCBNZWRpY2F0aW9uQWRtaW5pc3RyYXRpb24gewogIGlkICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBwcmVzY3JpcHRpb25faWQgICBTdHJpbmcKICB2aXNpdF9pZCAgICAgICAgICBTdHJpbmc/CiAgc2NoZWR1bGVkX3RpbWUgICAgRGF0ZVRpbWUKICBhZG1pbmlzdGVyZWRfdGltZSBEYXRlVGltZT8KICBhZG1pbmlzdGVyZWRfYnkgICBTdHJpbmc/CiAgc3RhdHVzICAgICAgICAgICAgTWVkaWNhdGlvblN0YXR1cyAgICBAZGVmYXVsdChTQ0hFRFVMRUQpCiAgbm90ZXMgICAgICAgICAgICAgU3RyaW5nPwogIHByZXNjcmlwdGlvbiAgICAgIFByZXNjcmlwdGlvbiAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW3ByZXNjcmlwdGlvbl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCiAgdmlzaXQgICAgICAgICAgICAgVmlzaXQ/ICAgICAgICAgICAgICBAcmVsYXRpb24oZmllbGRzOiBbdmlzaXRfaWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIGF1ZGl0cyAgICAgICAgICAgIE1lZGljYXRpb25BdWRpdFtdCiAgY3JlYXRlZF9hdCAgICAgICAgRGF0ZVRpbWUgICAgICAgICAgICBAZGVmYXVsdChub3coKSkKICB1cGRhdGVkX2F0ICAgICAgICBEYXRlVGltZSAgICAgICAgICAgIEB1cGRhdGVkQXQKICBkZWxldGVkX2F0ICAgICAgICBEYXRlVGltZT8KCiAgQEBpbmRleChbcHJlc2NyaXB0aW9uX2lkXSkKICBAQGluZGV4KFt2aXNpdF9pZF0pCiAgQEBpbmRleChbc2NoZWR1bGVkX3RpbWVdKQogIEBAaW5kZXgoW3N0YXR1cywgc2NoZWR1bGVkX3RpbWVdKQogIEBAbWFwKCJtZWRpY2F0aW9uX2FkbWluaXN0cmF0aW9uIikKfQoKbW9kZWwgTWVkaWNhdGlvbkF1ZGl0IHsKICBpZCAgICAgICAgICAgICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgICAgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSkKICBwcmVzY3JpcHRpb25faWQgICAgICAgICAgICAgIFN0cmluZz8KICBtZWRpY2F0aW9uX2FkbWluaXN0cmF0aW9uX2lkIFN0cmluZz8KICBhY3Rpb24gICAgICAgICAgICAgICAgICAgICAgIE1lZGljYXRpb25BdWRpdEFjdGlvbgogIGFjdG9yX2lkICAgICAgICAgICAgICAgICAgICAgU3RyaW5nCiAgYWN0b3Jfcm9sZSAgICAgICAgICAgICAgICAgICBTdHJpbmcKICBjaGFuZ2VzICAgICAgICAgICAgICAgICAgICAgIFN0cmluZyAvLyBKU09OIG9iamVjdCBvZiB3aGF0IGNoYW5nZWQKICB0aW1lc3RhbXAgICAgICAgICAgICAgICAgICAgIERhdGVUaW1lICAgICAgICAgICAgICAgICAgQGRlZmF1bHQobm93KCkpCiAgcHJlc2NyaXB0aW9uICAgICAgICAgICAgICAgICBQcmVzY3JpcHRpb24/ICAgICAgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtwcmVzY3JpcHRpb25faWRdLCByZWZlcmVuY2VzOiBbaWRdKQogIG1lZGljYXRpb25fYWRtaW5pc3RyYXRpb24gICAgTWVkaWNhdGlvbkFkbWluaXN0cmF0aW9uPyBAcmVsYXRpb24oZmllbGRzOiBbbWVkaWNhdGlvbl9hZG1pbmlzdHJhdGlvbl9pZF0sIHJlZmVyZW5jZXM6IFtpZF0pCgogIEBAaW5kZXgoW3ByZXNjcmlwdGlvbl9pZF0pCiAgQEBpbmRleChbbWVkaWNhdGlvbl9hZG1pbmlzdHJhdGlvbl9pZF0pCiAgQEBpbmRleChbdGltZXN0YW1wXSkKICBAQG1hcCgibWVkaWNhdGlvbl9hdWRpdCIpCn0KCmVudW0gTWVkaWNhdGlvblN0YXR1cyB7CiAgU0NIRURVTEVECiAgQURNSU5JU1RFUkVECiAgTUlTU0VECiAgUkVGVVNFRAogIENBTkNFTExFRAp9CgplbnVtIE1lZGljYXRpb25BdWRpdEFjdGlvbiB7CiAgUFJFU0NSSVBUSU9OX0NSRUFURUQKICBQUkVTQ1JJUFRJT05fVVBEQVRFRAogIFBSRVNDUklQVElPTl9ERUxFVEVECiAgTUVESUNBVElPTl9TQ0hFRFVMRUQKICBNRURJQ0FUSU9OX0FETUlOSVNURVJFRAogIE1FRElDQVRJT05fTUlTU0VECiAgTUVESUNBVElPTl9SRUZVU0VECiAgTUVESUNBVElPTl9DQU5DRUxMRUQKfQo=",
  "inlineSchemaHash": "8d7bd40d266a3b425dbc4c9b02e7a907544380da0144964cb255a538cf51580f",
  "noEngine": false
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"Carer\":{\"dbName\":\"carer\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"first_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"last_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"phone\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"hire_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"CarerToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Client\":{\"dbName\":\"client\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"full_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"address_line1\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"address_line2\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"city\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"postcode\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"date_of_birth\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"ClientToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"ClientToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Visit\":{\"dbName\":\"visit\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"carer_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actual_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actual_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"VisitStatus\",\"default\":\"SCHEDULED\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"carer\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Carer\",\"relationName\":\"CarerToVisit\",\"relationFromFields\":[\"carer_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToVisit\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"tasks\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"VisitTask\",\"relationName\":\"VisitToVisitTask\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administrations\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToVisit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"VisitTask\":{\"dbName\":\"visit_task\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"task_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_completed\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"completed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"VisitToVisitTask\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Medication\":{\"dbName\":\"medication\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"dosage\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"unit\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"instructions\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Prescription\":{\"dbName\":\"prescription\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"start_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"end_date\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"frequency_per_day\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"frequency_interval_hours\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administration_times\",\"kind\":\"scalar\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"special_instructions\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"client\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Client\",\"relationName\":\"ClientToPrescription\",\"relationFromFields\":[\"client_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Medication\",\"relationName\":\"MedicationToPrescription\",\"relationFromFields\":[\"medication_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administrations\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"audits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAudit\",\"relationName\":\"MedicationAuditToPrescription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"MedicationAdministration\":{\"dbName\":\"medication_administration\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scheduled_time\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administered_time\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"administered_by\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"MedicationStatus\",\"default\":\"SCHEDULED\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationAdministrationToPrescription\",\"relationFromFields\":[\"prescription_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visit\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Visit\",\"relationName\":\"MedicationAdministrationToVisit\",\"relationFromFields\":[\"visit_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"audits\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAudit\",\"relationName\":\"MedicationAdministrationToMedicationAudit\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"deleted_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"MedicationAudit\":{\"dbName\":\"medication_audit\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"uuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administration_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"action\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAuditAction\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actor_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actor_role\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"changes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"prescription\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Prescription\",\"relationName\":\"MedicationAuditToPrescription\",\"relationFromFields\":[\"prescription_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"medication_administration\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MedicationAdministration\",\"relationName\":\"MedicationAdministrationToMedicationAudit\",\"relationFromFields\":[\"medication_administration_id\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false}},\"enums\":{\"VisitStatus\":{\"values\":[{\"name\":\"SCHEDULED\",\"dbName\":null},{\"name\":\"IN_PROGRESS\",\"dbName\":null},{\"name\":\"COMPLETED\",\"dbName\":null},{\"name\":\"CANCELLED\",\"dbName\":null}],\"dbName\":null},\"MedicationStatus\":{\"values\":[{\"name\":\"SCHEDULED\",\"dbName\":null},{\"name\":\"ADMINISTERED\",\"dbName\":null},{\"name\":\"MISSED\",\"dbName\":null},{\"name\":\"REFUSED\",\"dbName\":null},{\"name\":\"CANCELLED\",\"dbName\":null}],\"dbName\":null},\"MedicationAuditAction\":{\"values\":[{\"name\":\"PRESCRIPTION_CREATED\",\"dbName\":null},{\"name\":\"PRESCRIPTION_UPDATED\",\"dbName\":null},{\"name\":\"PRESCRIPTION_DELETED\",\"dbName\":null},{\"name\":\"MEDICATION_SCHEDULED\",\"dbName\":null},{\"name\":\"MEDICATION_ADMINISTERED\",\"dbName\":null},{\"name\":\"MEDICATION_MISSED\",\"dbName\":null},{\"name\":\"MEDICATION_REFUSED\",\"dbName\":null},{\"name\":\"MEDICATION_CANCELLED\",\"dbName\":null}],\"dbName\":null}},\"types\":{}}")
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

