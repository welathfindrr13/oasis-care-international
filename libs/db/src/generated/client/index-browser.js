
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  detectRuntime,
} = require('./runtime/index-browser')


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

Prisma.PrismaClientKnownRequestError = () => {
  throw new Error(`PrismaClientKnownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  throw new Error(`PrismaClientUnknownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientRustPanicError = () => {
  throw new Error(`PrismaClientRustPanicError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientInitializationError = () => {
  throw new Error(`PrismaClientInitializationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientValidationError = () => {
  throw new Error(`PrismaClientValidationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.NotFoundError = () => {
  throw new Error(`NotFoundError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  throw new Error(`sqltag is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.empty = () => {
  throw new Error(`empty is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.join = () => {
  throw new Error(`join is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.raw = () => {
  throw new Error(`raw is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  throw new Error(`Extensions.getExtensionContext is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.defineExtension = () => {
  throw new Error(`Extensions.defineExtension is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}

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
  organization_id: 'organization_id',
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
  organization_id: 'organization_id',
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

exports.Prisma.CarerShiftScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  carer_id: 'carer_id',
  clock_in_at: 'clock_in_at',
  clock_out_at: 'clock_out_at',
  clock_in_method: 'clock_in_method',
  clock_out_method: 'clock_out_method',
  clock_in_lat: 'clock_in_lat',
  clock_in_lng: 'clock_in_lng',
  clock_in_accuracy_m: 'clock_in_accuracy_m',
  clock_out_lat: 'clock_out_lat',
  clock_out_lng: 'clock_out_lng',
  clock_out_accuracy_m: 'clock_out_accuracy_m',
  clock_in_source: 'clock_in_source',
  clock_out_source: 'clock_out_source',
  clock_in_reason_code: 'clock_in_reason_code',
  clock_out_reason_code: 'clock_out_reason_code',
  location_consent_at: 'location_consent_at',
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
  organization_id: 'organization_id',
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

exports.Prisma.FamilyContactScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  auth_subject: 'auth_subject',
  email: 'email',
  phone: 'phone',
  full_name: 'full_name',
  relationship: 'relationship',
  identity_type: 'identity_type',
  disabled_at: 'disabled_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.CareRoomScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  client_id: 'client_id',
  status: 'status',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.CareRoomMembershipScalarFieldEnum = {
  id: 'id',
  care_room_id: 'care_room_id',
  family_contact_id: 'family_contact_id',
  role: 'role',
  status: 'status',
  access_basis: 'access_basis',
  consent_record_id: 'consent_record_id',
  review_due_at: 'review_due_at',
  invited_by_user_id: 'invited_by_user_id',
  approved_by_user_id: 'approved_by_user_id',
  revoked_by_user_id: 'revoked_by_user_id',
  invited_at: 'invited_at',
  accepted_at: 'accepted_at',
  revoked_at: 'revoked_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.AccessGrantScalarFieldEnum = {
  id: 'id',
  care_room_membership_id: 'care_room_membership_id',
  scope: 'scope',
  granted_at: 'granted_at',
  revoked_at: 'revoked_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.CareBridgePolicyScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  care_room_id: 'care_room_id',
  client_id: 'client_id',
  show_carer_name_default: 'show_carer_name_default',
  show_visit_times_default: 'show_visit_times_default',
  show_task_summary_default: 'show_task_summary_default',
  show_medication_support_default: 'show_medication_support_default',
  require_approval_for_all_content: 'require_approval_for_all_content',
  family_can_raise_concerns: 'family_can_raise_concerns',
  family_can_reply_to_concerns: 'family_can_reply_to_concerns',
  family_can_submit_pulse: 'family_can_submit_pulse',
  digest_enabled: 'digest_enabled',
  ai_drafting_enabled: 'ai_drafting_enabled',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.VerifiedVisitStoryScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  care_room_id: 'care_room_id',
  client_id: 'client_id',
  visit_id: 'visit_id',
  status: 'status',
  draft_title: 'draft_title',
  draft_body: 'draft_body',
  approved_title: 'approved_title',
  approved_body: 'approved_body',
  rejection_reason: 'rejection_reason',
  source_refs: 'source_refs',
  approved_by_id: 'approved_by_id',
  approved_at: 'approved_at',
  published_at: 'published_at',
  rejected_at: 'rejected_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ConcernScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  care_room_id: 'care_room_id',
  client_id: 'client_id',
  title: 'title',
  description: 'description',
  severity: 'severity',
  priority: 'priority',
  category: 'category',
  status: 'status',
  outcome: 'outcome',
  raised_by_membership_id: 'raised_by_membership_id',
  raised_by_user_id: 'raised_by_user_id',
  assigned_to_user_id: 'assigned_to_user_id',
  acknowledgement_due_at: 'acknowledgement_due_at',
  acknowledged_at: 'acknowledged_at',
  response_due_at: 'response_due_at',
  resolution_due_at: 'resolution_due_at',
  resolved_at: 'resolved_at',
  escalated_at: 'escalated_at',
  source_refs: 'source_refs',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ConcernMessageScalarFieldEnum = {
  id: 'id',
  concern_id: 'concern_id',
  actor_type: 'actor_type',
  actor_label: 'actor_label',
  actor_id: 'actor_id',
  body: 'body',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ConcernEventScalarFieldEnum = {
  id: 'id',
  concern_id: 'concern_id',
  event_type: 'event_type',
  actor_type: 'actor_type',
  actor_id: 'actor_id',
  metadata: 'metadata',
  created_at: 'created_at'
};

exports.Prisma.WeeklyCareSummaryScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  care_room_id: 'care_room_id',
  client_id: 'client_id',
  period_start: 'period_start',
  period_end: 'period_end',
  status: 'status',
  draft_title: 'draft_title',
  draft_body: 'draft_body',
  approved_title: 'approved_title',
  approved_body: 'approved_body',
  rejection_reason: 'rejection_reason',
  source_refs: 'source_refs',
  approved_by_id: 'approved_by_id',
  approved_at: 'approved_at',
  published_at: 'published_at',
  rejected_at: 'rejected_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.FamilyPulseScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  care_room_id: 'care_room_id',
  care_room_membership_id: 'care_room_membership_id',
  sentiment: 'sentiment',
  note: 'note',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.AssessmentScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  client_id: 'client_id',
  visit_id: 'visit_id',
  status: 'status',
  source: 'source',
  title: 'title',
  summary: 'summary',
  findings: 'findings',
  risk_flags: 'risk_flags',
  recommended_actions: 'recommended_actions',
  assessor_id: 'assessor_id',
  completed_at: 'completed_at',
  review_due_at: 'review_due_at',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.CarePlanScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  client_id: 'client_id',
  assessment_id: 'assessment_id',
  status: 'status',
  version: 'version',
  title: 'title',
  goals: 'goals',
  interventions: 'interventions',
  safety_notes: 'safety_notes',
  effective_from: 'effective_from',
  effective_to: 'effective_to',
  review_due_at: 'review_due_at',
  authored_by_id: 'authored_by_id',
  approved_by_id: 'approved_by_id',
  approved_at: 'approved_at',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
};

exports.Prisma.EvidencePackScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  client_id: 'client_id',
  care_plan_id: 'care_plan_id',
  status: 'status',
  kind: 'kind',
  period_start: 'period_start',
  period_end: 'period_end',
  summary: 'summary',
  source_refs: 'source_refs',
  generated_by: 'generated_by',
  generated_at: 'generated_at',
  published_at: 'published_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.EvidenceItemScalarFieldEnum = {
  id: 'id',
  evidence_pack_id: 'evidence_pack_id',
  source_type: 'source_type',
  source_id: 'source_id',
  occurred_at: 'occurred_at',
  headline: 'headline',
  detail: 'detail',
  metadata: 'metadata',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.OrganizationIdentityScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  identity_provider: 'identity_provider',
  identity_subject: 'identity_subject',
  normalized_email: 'normalized_email',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.OrganizationMembershipScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  identity_provider: 'identity_provider',
  auth_subject: 'auth_subject',
  normalized_email: 'normalized_email',
  role: 'role',
  status: 'status',
  external_organization_id: 'external_organization_id',
  external_membership_id: 'external_membership_id',
  metadata: 'metadata',
  revoked_at: 'revoked_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.CareLogScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  visit_id: 'visit_id',
  client_id: 'client_id',
  carer_id: 'carer_id',
  medication_administration_id: 'medication_administration_id',
  occurred_at: 'occurred_at',
  category: 'category',
  notes: 'notes',
  urine_passed: 'urine_passed',
  bowel_movement: 'bowel_movement',
  stool_type: 'stool_type',
  continence_status: 'continence_status',
  assistance_level: 'assistance_level',
  meal_type: 'meal_type',
  intake_amount: 'intake_amount',
  fluid_ml: 'fluid_ml',
  appetite: 'appetite',
  slept: 'slept',
  sleep_start: 'sleep_start',
  sleep_end: 'sleep_end',
  sleep_quality: 'sleep_quality',
  mood_level: 'mood_level',
  agitation: 'agitation',
  confusion: 'confusion',
  pain_score: 'pain_score',
  escalated: 'escalated',
  escalated_to: 'escalated_to',
  escalated_at: 'escalated_at',
  source: 'source',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
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
  organization_id: 'organization_id',
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
  organization_id: 'organization_id',
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
  organization_id: 'organization_id',
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

exports.ShiftVerificationMethod = exports.$Enums.ShiftVerificationMethod = {
  GPS: 'GPS',
  QR: 'QR',
  NFC: 'NFC',
  PHONE: 'PHONE',
  MANUAL: 'MANUAL'
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

exports.CareRoomStatus = exports.$Enums.CareRoomStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  REVOKED: 'REVOKED'
};

exports.CareRoomRole = exports.$Enums.CareRoomRole = {
  PRIMARY_CONTACT: 'PRIMARY_CONTACT',
  FAMILY_VIEWER: 'FAMILY_VIEWER',
  FAMILY_CONTRIBUTOR: 'FAMILY_CONTRIBUTOR',
  LEGAL_REPRESENTATIVE: 'LEGAL_REPRESENTATIVE',
  EMERGENCY_CONTACT: 'EMERGENCY_CONTACT',
  PROFESSIONAL_VIEWER: 'PROFESSIONAL_VIEWER'
};

exports.CareRoomMembershipStatus = exports.$Enums.CareRoomMembershipStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED'
};

exports.FamilyAccessBasis = exports.$Enums.FamilyAccessBasis = {
  CLIENT_CONSENT: 'CLIENT_CONSENT',
  HEALTH_WELFARE_ATTORNEY: 'HEALTH_WELFARE_ATTORNEY',
  EMERGENCY_ACCESS: 'EMERGENCY_ACCESS',
  BEST_INTERESTS: 'BEST_INTERESTS',
  PROFESSIONAL_VIEWER: 'PROFESSIONAL_VIEWER',
  PROVIDER_AUTHORISED: 'PROVIDER_AUTHORISED'
};

exports.AccessGrantScope = exports.$Enums.AccessGrantScope = {
  VIEW_UPDATES: 'VIEW_UPDATES',
  VIEW_VISIT_TIMES: 'VIEW_VISIT_TIMES',
  VIEW_TASK_SUMMARY: 'VIEW_TASK_SUMMARY',
  VIEW_MEDICATION_SUPPORT_STATUS: 'VIEW_MEDICATION_SUPPORT_STATUS',
  VIEW_WEEKLY_SUMMARIES: 'VIEW_WEEKLY_SUMMARIES',
  RAISE_CONCERNS: 'RAISE_CONCERNS',
  REPLY_TO_CONCERNS: 'REPLY_TO_CONCERNS',
  SUBMIT_PULSE: 'SUBMIT_PULSE'
};

exports.CarebridgeContentStatus = exports.$Enums.CarebridgeContentStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED'
};

exports.ConcernSeverity = exports.$Enums.ConcernSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

exports.ConcernPriority = exports.$Enums.ConcernPriority = {
  ROUTINE: 'ROUTINE',
  PRIORITY: 'PRIORITY',
  URGENT: 'URGENT'
};

exports.ConcernCategory = exports.$Enums.ConcernCategory = {
  VISIT_DELIVERY: 'VISIT_DELIVERY',
  COMMUNICATION: 'COMMUNICATION',
  MEDICATION_SUPPORT: 'MEDICATION_SUPPORT',
  WELLBEING_CHANGE: 'WELLBEING_CHANGE',
  SCHEDULING: 'SCHEDULING',
  OTHER: 'OTHER'
};

exports.ConcernStatus = exports.$Enums.ConcernStatus = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  ESCALATED: 'ESCALATED',
  CLOSED: 'CLOSED'
};

exports.ConcernOutcome = exports.$Enums.ConcernOutcome = {
  RESOLVED: 'RESOLVED',
  NO_ACTION_REQUIRED: 'NO_ACTION_REQUIRED',
  CARE_PLAN_REVIEW_REQUIRED: 'CARE_PLAN_REVIEW_REQUIRED',
  CALLBACK_COMPLETED: 'CALLBACK_COMPLETED',
  ESCALATED_TO_MANAGER: 'ESCALATED_TO_MANAGER',
  ESCALATED_TO_INCIDENT: 'ESCALATED_TO_INCIDENT',
  ESCALATED_TO_SAFEGUARDING: 'ESCALATED_TO_SAFEGUARDING',
  FAMILY_NOT_SATISFIED: 'FAMILY_NOT_SATISFIED'
};

exports.ConcernActorType = exports.$Enums.ConcernActorType = {
  STAFF: 'STAFF',
  FAMILY: 'FAMILY',
  SYSTEM: 'SYSTEM'
};

exports.ConcernEventType = exports.$Enums.ConcernEventType = {
  RAISED: 'RAISED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ASSIGNED: 'ASSIGNED',
  RESPONDED: 'RESPONDED',
  RESOLVED: 'RESOLVED',
  REOPENED: 'REOPENED',
  ESCALATED: 'ESCALATED'
};

exports.FamilyPulseSentiment = exports.$Enums.FamilyPulseSentiment = {
  CONFIDENT: 'CONFIDENT',
  UNSURE: 'UNSURE',
  CONCERNED: 'CONCERNED',
  NEED_CALL: 'NEED_CALL'
};

exports.AssessmentStatus = exports.$Enums.AssessmentStatus = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
};

exports.AssessmentSource = exports.$Enums.AssessmentSource = {
  MANUAL: 'MANUAL',
  VISIT_REVIEW: 'VISIT_REVIEW',
  HOSPITAL_DISCHARGE: 'HOSPITAL_DISCHARGE',
  REFERRAL_HANDOFF: 'REFERRAL_HANDOFF'
};

exports.CarePlanStatus = exports.$Enums.CarePlanStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED'
};

exports.EvidencePackStatus = exports.$Enums.EvidencePackStatus = {
  DRAFT: 'DRAFT',
  COMPILED: 'COMPILED',
  PUBLISHED: 'PUBLISHED'
};

exports.EvidenceSourceType = exports.$Enums.EvidenceSourceType = {
  VISIT: 'VISIT',
  CARE_LOG: 'CARE_LOG',
  MEDICATION_ADMINISTRATION: 'MEDICATION_ADMINISTRATION',
  ASSESSMENT: 'ASSESSMENT',
  CARE_PLAN: 'CARE_PLAN',
  CONCERN: 'CONCERN',
  MANUAL_NOTE: 'MANUAL_NOTE'
};

exports.OrganizationMembershipStatus = exports.$Enums.OrganizationMembershipStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REVOKED: 'REVOKED'
};

exports.CareLogCategory = exports.$Enums.CareLogCategory = {
  TOILETING: 'TOILETING',
  NUTRITION: 'NUTRITION',
  HYDRATION: 'HYDRATION',
  SLEEP: 'SLEEP',
  MOOD: 'MOOD',
  MOBILITY: 'MOBILITY',
  MEDICATION: 'MEDICATION',
  SKIN: 'SKIN',
  PAIN: 'PAIN',
  INCIDENT: 'INCIDENT',
  OTHER: 'OTHER'
};

exports.StoolType = exports.$Enums.StoolType = {
  TYPE_1: 'TYPE_1',
  TYPE_2: 'TYPE_2',
  TYPE_3: 'TYPE_3',
  TYPE_4: 'TYPE_4',
  TYPE_5: 'TYPE_5',
  TYPE_6: 'TYPE_6',
  TYPE_7: 'TYPE_7'
};

exports.IntakeAmount = exports.$Enums.IntakeAmount = {
  NONE: 'NONE',
  QUARTER: 'QUARTER',
  HALF: 'HALF',
  MOST: 'MOST',
  ALL: 'ALL'
};

exports.MoodLevel = exports.$Enums.MoodLevel = {
  VERY_LOW: 'VERY_LOW',
  LOW: 'LOW',
  NEUTRAL: 'NEUTRAL',
  GOOD: 'GOOD',
  VERY_GOOD: 'VERY_GOOD'
};

exports.Prisma.ModelName = {
  Carer: 'Carer',
  Client: 'Client',
  Visit: 'Visit',
  VisitTask: 'VisitTask',
  CarerShift: 'CarerShift',
  Medication: 'Medication',
  Prescription: 'Prescription',
  MedicationAdministration: 'MedicationAdministration',
  MedicationAudit: 'MedicationAudit',
  Organization: 'Organization',
  FamilyContact: 'FamilyContact',
  CareRoom: 'CareRoom',
  CareRoomMembership: 'CareRoomMembership',
  AccessGrant: 'AccessGrant',
  CareBridgePolicy: 'CareBridgePolicy',
  VerifiedVisitStory: 'VerifiedVisitStory',
  Concern: 'Concern',
  ConcernMessage: 'ConcernMessage',
  ConcernEvent: 'ConcernEvent',
  WeeklyCareSummary: 'WeeklyCareSummary',
  FamilyPulse: 'FamilyPulse',
  Assessment: 'Assessment',
  CarePlan: 'CarePlan',
  EvidencePack: 'EvidencePack',
  EvidenceItem: 'EvidenceItem',
  OrganizationIdentity: 'OrganizationIdentity',
  OrganizationMembership: 'OrganizationMembership',
  CareLog: 'CareLog',
  LogEmbedding: 'LogEmbedding',
  HealthSummary: 'HealthSummary',
  ConsentRecord: 'ConsentRecord',
  AuditLog: 'AuditLog',
  RetentionPolicy: 'RetentionPolicy',
  ErasureQueue: 'ErasureQueue'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        const runtime = detectRuntime()
        const edgeRuntimeName = {
          'workerd': 'Cloudflare Workers',
          'deno': 'Deno and Deno Deploy',
          'netlify': 'Netlify Edge Functions',
          'edge-light': 'Vercel Edge Functions',
        }[runtime]

        let message = 'PrismaClient is unable to run in '
        if (edgeRuntimeName !== undefined) {
          message += edgeRuntimeName + '. As an alternative, try Accelerate: https://pris.ly/d/accelerate.'
        } else {
          message += 'this browser environment, or has been bundled for the browser (running in `' + runtime + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://github.com/prisma/prisma/issues`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
