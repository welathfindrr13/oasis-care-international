/**
 * GraphQL queries for Oasis Care application
 */

// TypeScript types based on the GraphQL schema
export interface VisitStatus {
  SCHEDULED: 'SCHEDULED';
  IN_PROGRESS: 'IN_PROGRESS';  
  COMPLETED: 'COMPLETED';
  CANCELLED: 'CANCELLED';
}

export interface Carer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface Client {
  id: string;
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
}

export interface VisitTask {
  id: string;
  taskName: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  carerId: string;
  clientId: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: keyof VisitStatus;
  notes?: string;
  carer?: Carer;
  client?: Client;
  tasks: VisitTask[];
  createdAt: string;
  updatedAt: string;
}

export interface VisitPaginatedResponse {
  items: Visit[];
  total: number;
}

export interface VisitsQueryResponse {
  visits: VisitPaginatedResponse;
}

export interface VisitsQueryVariables {
  scheduledStartFrom?: string;
  scheduledStartTo?: string;
  carerId?: string;
  clientId?: string;
  status?: keyof VisitStatus;
  skip?: number;
  take?: number;
}

/**
 * Query to fetch visits with filtering and pagination
 */
export const VISITS_QUERY = `
  query Visits($scheduledStartFrom: String, $scheduledStartTo: String, $carerId: ID, $clientId: ID, $status: VisitStatus, $skip: Int, $take: Int) {
    visits(
      scheduledStartFrom: $scheduledStartFrom
      scheduledStartTo: $scheduledStartTo
      carerId: $carerId 
      clientId: $clientId
      status: $status
      skip: $skip
      take: $take
    ) {
      items {
        id
        carerId
        clientId
        scheduledStart
        scheduledEnd
        actualStart
        actualEnd
        status
        notes
        carer {
          id
          firstName
          lastName
          email
          phone
        }
        client {
          id
          fullName
          addressLine1
          addressLine2
          city
          postcode
        }
        tasks {
          id
          taskName
          description
          isCompleted
          completedAt
          notes
          createdAt
          updatedAt
        }
        createdAt
        updatedAt
      }
      total
    }
  }
`;

/**
 * Default pagination settings
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Calculate skip from page number (for Prisma pagination)
 */
export function getSkipFromPage(page: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  return Math.max(0, (page - 1) * pageSize);
}

/**
 * Calculate total pages from total count
 */
export function getTotalPages(totalCount: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  return Math.ceil(totalCount / pageSize);
}

// ==================== CLIENT QUERIES ====================

export interface ClientListItem {
  id: string;
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  // Note: lastVisitAt and nextVisitAt are not yet supported by the API
  lastVisitAt?: string;
  nextVisitAt?: string;
}

export interface ClientsQueryResponse {
  clients: {
    items: ClientListItem[];
    total: number;
  };
}

export interface ClientsQueryVariables {
  search?: string;
  skip?: number;
  take?: number;
}

export interface ClientQueryResponse {
  client: ClientListItem;
}

/**
 * Query to fetch clients with pagination and search
 * Note: lastVisitAt and nextVisitAt are not yet supported by the API
 */
export const CLIENTS_QUERY = `
  query Clients($skip: Int, $take: Int, $search: String) {
    clients(skip: $skip, take: $take, search: $search) {
      items {
        id
        fullName
        addressLine1
        addressLine2
        city
        postcode
      }
      total
    }
  }
`;

export const CLIENT_QUERY = `
  query Client($id: String!) {
    client(id: $id) {
      id
      fullName
      addressLine1
      addressLine2
      city
      postcode
    }
  }
`;

// ==================== CARE PLANNING QUERIES ====================

export interface AssessmentRecord {
  id: string;
  clientId: string;
  visitId?: string | null;
  status: string;
  source: string;
  title: string;
  summary?: string | null;
  findings: Record<string, unknown>;
  riskFlags?: Record<string, unknown> | null;
  recommendedActions?: Record<string, unknown> | null;
  completedAt?: string | null;
  reviewDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanRecord {
  id: string;
  clientId: string;
  assessmentId?: string | null;
  status: string;
  version: number;
  title: string;
  goals: Record<string, unknown>;
  interventions: Record<string, unknown>;
  safetyNotes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  reviewDueAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidencePackItemRecord {
  id: string;
  sourceType: string;
  sourceId?: string | null;
  occurredAt?: string | null;
  headline: string;
  detail?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface EvidencePackRecord {
  id: string;
  clientId: string;
  carePlanId?: string | null;
  status: string;
  kind: string;
  periodStart: string;
  periodEnd: string;
  summary?: Record<string, unknown> | null;
  sourceRefs: Record<string, unknown>;
  generatedBy: string;
  generatedAt: string;
  publishedAt?: string | null;
  items: EvidencePackItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export type OperationalEvidenceSourceType = 'VISIT' | 'CARE_LOG' | 'MEDICATION_ADMINISTRATION' | 'CONCERN';

export interface EvidenceSourceCandidateRecord {
  id: string;
  sourceType: OperationalEvidenceSourceType;
  title: string;
  subtitle?: string | null;
  occurredAt: string;
  createdBy?: string | null;
  status?: string | null;
  previewText?: string | null;
}

export interface EvidenceSourceCandidatesQueryResponse {
  evidenceSourceCandidates: EvidenceSourceCandidateRecord[];
}

export interface CarePlanningQueryResponse {
  assessments: AssessmentRecord[];
  carePlans: CarePlanRecord[];
  evidencePacks: EvidencePackRecord[];
}

export interface CreateAssessmentInput {
  clientId: string;
  status?: 'DRAFT' | 'IN_REVIEW' | 'COMPLETED' | 'ARCHIVED';
  source?: 'MANUAL' | 'VISIT_REVIEW' | 'HOSPITAL_DISCHARGE' | 'REFERRAL_HANDOFF';
  title: string;
  summary?: string;
  findings: Record<string, unknown>;
  riskFlags?: Record<string, unknown>;
  recommendedActions?: Record<string, unknown>;
  completedAt?: string;
  reviewDueAt?: string;
}

export interface CreateCarePlanInput {
  clientId: string;
  assessmentId?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
  version?: number;
  title: string;
  goals: Record<string, unknown>;
  interventions: Record<string, unknown>;
  safetyNotes?: string;
  effectiveFrom?: string;
  reviewDueAt?: string;
}

export interface CreateEvidencePackItemInput {
  sourceType: 'VISIT' | 'CARE_LOG' | 'MEDICATION_ADMINISTRATION' | 'ASSESSMENT' | 'CARE_PLAN' | 'CONCERN' | 'MANUAL_NOTE';
  sourceId?: string;
  occurredAt?: string;
  headline: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateEvidencePackInput {
  clientId: string;
  carePlanId?: string;
  status?: 'DRAFT' | 'COMPILED' | 'PUBLISHED';
  kind?: string;
  periodStart: string;
  periodEnd: string;
  summary?: Record<string, unknown>;
  sourceRefs?: Record<string, unknown>;
  generatedBy?: string;
  publishedAt?: string;
  items?: CreateEvidencePackItemInput[];
}

export interface CompleteAssessmentInput {
  assessmentId: string;
  completedAt?: string;
  reviewDueAt?: string;
}

export interface ApproveCarePlanInput {
  carePlanId: string;
  approvedAt?: string;
  effectiveFrom?: string;
  reviewDueAt?: string;
}

export interface ArchiveCarePlanInput {
  carePlanId: string;
  effectiveTo?: string;
}

export const CARE_PLANNING_QUERY = `
  query CarePlanning($clientId: String!, $take: Int) {
    assessments(clientId: $clientId, take: $take) {
      id
      clientId
      visitId
      status
      source
      title
      summary
      findings
      riskFlags
      recommendedActions
      completedAt
      reviewDueAt
      createdAt
      updatedAt
    }
    carePlans(clientId: $clientId, take: $take) {
      id
      clientId
      assessmentId
      status
      version
      title
      goals
      interventions
      safetyNotes
      effectiveFrom
      effectiveTo
      reviewDueAt
      approvedAt
      createdAt
      updatedAt
    }
    evidencePacks(clientId: $clientId, take: $take) {
      id
      clientId
      carePlanId
      status
      kind
      periodStart
      periodEnd
      summary
      sourceRefs
      generatedBy
      generatedAt
      publishedAt
      items {
        id
        sourceType
        sourceId
        occurredAt
        headline
        detail
        metadata
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const EVIDENCE_SOURCE_CANDIDATES_QUERY = `
  query EvidenceSourceCandidates($input: EvidenceSourceCandidatesInput!) {
    evidenceSourceCandidates(input: $input) {
      id
      sourceType
      title
      subtitle
      occurredAt
      createdBy
      status
      previewText
    }
  }
`;

export interface EvidencePackQueryResponse {
  getEvidencePack: EvidencePackRecord;
}

export const EVIDENCE_PACK_QUERY = `
  query EvidencePack($id: String!) {
    getEvidencePack(id: $id) {
      id
      clientId
      carePlanId
      status
      kind
      periodStart
      periodEnd
      summary
      sourceRefs
      generatedBy
      generatedAt
      publishedAt
      items {
        id
        sourceType
        sourceId
        occurredAt
        headline
        detail
        metadata
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const RECORD_EVIDENCE_PACK_EXPORT_MUTATION = `
  mutation RecordEvidencePackExport($id: String!) {
    recordEvidencePackExport(id: $id) {
      id
      status
      generatedAt
      updatedAt
    }
  }
`;

export const COMPLETE_ASSESSMENT_MUTATION = `
  mutation CompleteAssessment($input: CompleteAssessmentInput!) {
    completeAssessment(input: $input) {
      id
      status
      completedAt
      reviewDueAt
      updatedAt
    }
  }
`;

export const APPROVE_CARE_PLAN_MUTATION = `
  mutation ApproveCarePlan($input: ApproveCarePlanInput!) {
    approveCarePlan(input: $input) {
      id
      status
      approvedAt
      effectiveFrom
      reviewDueAt
      updatedAt
    }
  }
`;

export const ARCHIVE_CARE_PLAN_MUTATION = `
  mutation ArchiveCarePlan($input: ArchiveCarePlanInput!) {
    archiveCarePlan(input: $input) {
      id
      status
      effectiveTo
      updatedAt
    }
  }
`;

export const CREATE_ASSESSMENT_MUTATION = `
  mutation CreateAssessment($input: CreateAssessmentInput!) {
    createAssessment(input: $input) {
      id
      clientId
      status
      source
      title
      summary
      completedAt
      reviewDueAt
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_CARE_PLAN_MUTATION = `
  mutation CreateCarePlan($input: CreateCarePlanInput!) {
    createCarePlan(input: $input) {
      id
      clientId
      assessmentId
      status
      version
      title
      effectiveFrom
      reviewDueAt
      approvedAt
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_EVIDENCE_PACK_MUTATION = `
  mutation CreateEvidencePack($input: CreateEvidencePackInput!) {
    createEvidencePack(input: $input) {
      id
      clientId
      carePlanId
      status
      kind
      periodStart
      periodEnd
      generatedAt
      publishedAt
      items {
        id
        sourceType
        headline
        detail
      }
      createdAt
      updatedAt
    }
  }
`;

export interface CreateVisitMutationVariables {
  input: {
    carerId: string;
    clientId: string;
    scheduledStart: string;
    scheduledEnd: string;
    notes?: string;
  };
}

export interface CreateVisitMutationResponse {
  createVisit: {
    id: string;
    status: keyof VisitStatus;
  };
}

export const CREATE_VISIT_MUTATION = `
  mutation CreateVisit($input: CreateVisitInput!) {
    createVisit(input: $input) {
      id
      status
    }
  }
`;

export interface EligibleCarerMembership {
  id: string
  identityProvider: string
  role: string
  loginEmail?: string | null
}

export interface EligibleCarerMembershipsQueryResponse {
  eligibleCarerMemberships: EligibleCarerMembership[]
}

export interface CreateAndLinkCarerMutationResponse {
  createAndLinkCarer: {
    membershipId: string
    carer: Carer
  }
}

export const ELIGIBLE_CARER_MEMBERSHIPS_QUERY = `
  query EligibleCarerMemberships {
    eligibleCarerMemberships {
      id
      identityProvider
      role
      loginEmail
    }
  }
`;

export const CREATE_AND_LINK_CARER_MUTATION = `
  mutation CreateAndLinkCarer($input: CreateLinkedCarerInput!) {
    createAndLinkCarer(input: $input) {
      membershipId
      carer {
        id
        firstName
        lastName
        email
        phone
      }
    }
  }
`;

export const DELETE_CLIENT_MUTATION = `
  mutation DeleteClient($id: String!) {
    deleteClient(id: $id) {
      id
      fullName
      addressLine1
      addressLine2
      city
      postcode
    }
  }
`;

// ==================== CAREBRIDGE QUERIES ====================

export interface CarebridgeFamilyContact {
  id: string
  fullName: string
  email?: string | null
  relationship?: string | null
}

export interface CarebridgeAccessGrant {
  id: string
  scope: string
  grantedAt: string
  revokedAt?: string | null
}

export interface CarebridgeMembership {
  id: string
  role: string
  status: string
  accessBasis: string
  reviewDueAt?: string | null
  familyContact: CarebridgeFamilyContact
  accessGrants: CarebridgeAccessGrant[]
}

export interface CarebridgePolicy {
  id: string
  showVisitTimesDefault: boolean
  showTaskSummaryDefault: boolean
  showMedicationSupportDefault: boolean
  requireApprovalForAllContent: boolean
  familyCanRaiseConcerns: boolean
  familyCanReplyToConcerns: boolean
  familyCanSubmitPulse: boolean
}

export interface CarebridgeRoom {
  id: string
  status: string
  client: {
    id: string
    fullName: string
  }
  memberships: CarebridgeMembership[]
  policy?: CarebridgePolicy | null
  createdAt: string
  updatedAt: string
}

export interface VerifiedVisitStory {
  id: string
  status: string
  draftTitle: string
  draftBody: string
  approvedTitle?: string | null
  approvedBody?: string | null
  approvedAt?: string | null
  rejectionReason?: string | null
  rejectedAt?: string | null
  sourceRefs: Array<Record<string, unknown>>
  publishedAt?: string | null
}

export interface CareRoomsQueryResponse {
  careRooms: CarebridgeRoom[]
}

export interface CareRoomQueryResponse {
  careRoom: CarebridgeRoom
}

export interface VerifiedVisitStoriesQueryResponse {
  verifiedVisitStories: VerifiedVisitStory[]
}

export interface VerifiedVisitStoryApprovalQueueQueryResponse {
  verifiedVisitStoryApprovalQueue: VerifiedVisitStory[]
}

export interface CarebridgeConcernMessage {
  id: string
  body: string
  actorLabel: string
  createdAt: string
}

export interface CarebridgeConcernEvent {
  id: string
  eventType: string
  createdAt: string
}

export interface CarebridgeConcern {
  id: string
  careRoomId: string
  clientId: string
  title: string
  description?: string | null
  severity: string
  priority: string
  category: string
  status: string
  outcome?: string | null
  acknowledgementDueAt?: string | null
  acknowledgedAt?: string | null
  responseDueAt?: string | null
  resolutionDueAt?: string | null
  resolvedAt?: string | null
  messages: CarebridgeConcernMessage[]
  events: CarebridgeConcernEvent[]
}

export interface CarebridgeConcernInboxQueryResponse {
  carebridgeConcernInbox: CarebridgeConcern[]
}

export const CAREBRIDGE_ROOMS_QUERY = `
  query CareRooms {
    careRooms {
      id
      status
      client {
        id
        fullName
      }
      memberships {
        id
        role
        status
        accessBasis
        reviewDueAt
        familyContact {
          id
          fullName
          email
          relationship
        }
        accessGrants {
          id
          scope
          grantedAt
          revokedAt
        }
      }
      policy {
        id
        showVisitTimesDefault
        showTaskSummaryDefault
        showMedicationSupportDefault
        requireApprovalForAllContent
        familyCanRaiseConcerns
        familyCanReplyToConcerns
        familyCanSubmitPulse
      }
      createdAt
      updatedAt
    }
  }
`

export const CAREBRIDGE_ROOM_QUERY = `
  query CareRoom($id: String!) {
    careRoom(id: $id) {
      id
      status
      client {
        id
        fullName
      }
      memberships {
        id
        role
        status
        accessBasis
        reviewDueAt
        familyContact {
          id
          fullName
          email
          relationship
        }
        accessGrants {
          id
          scope
          grantedAt
          revokedAt
        }
      }
      policy {
        id
        showVisitTimesDefault
        showTaskSummaryDefault
        showMedicationSupportDefault
        requireApprovalForAllContent
        familyCanRaiseConcerns
        familyCanReplyToConcerns
        familyCanSubmitPulse
      }
      createdAt
      updatedAt
    }
  }
`

export const VERIFIED_VISIT_STORIES_QUERY = `
  query VerifiedVisitStories($careRoomId: String!) {
    verifiedVisitStories(careRoomId: $careRoomId) {
      id
      status
      draftTitle
      draftBody
      approvedTitle
      approvedBody
      approvedAt
      rejectionReason
      rejectedAt
      sourceRefs
      publishedAt
    }
  }
`

export const VERIFIED_VISIT_STORY_APPROVAL_QUEUE_QUERY = `
  query VerifiedVisitStoryApprovalQueue($careRoomId: String) {
    verifiedVisitStoryApprovalQueue(careRoomId: $careRoomId) {
      id
      status
      draftTitle
      draftBody
      approvedTitle
      approvedBody
      approvedAt
      rejectionReason
      rejectedAt
      sourceRefs
      publishedAt
    }
  }
`

export const PUBLISH_VERIFIED_VISIT_STORY_MUTATION = `
  mutation PublishVerifiedVisitStory($storyId: String!) {
    publishVerifiedVisitStory(storyId: $storyId) {
      id
      status
      approvedTitle
      approvedBody
      approvedAt
      publishedAt
    }
  }
`

export const REJECT_VERIFIED_VISIT_STORY_MUTATION = `
  mutation RejectVerifiedVisitStory($input: RejectVerifiedVisitStoryInput!) {
    rejectVerifiedVisitStory(input: $input) {
      id
      status
      rejectionReason
      rejectedAt
    }
  }
`

export const CAREBRIDGE_CONCERN_INBOX_QUERY = `
  query CarebridgeConcernInbox($status: String) {
    carebridgeConcernInbox(status: $status) {
      id
      careRoomId
      clientId
      title
      description
      severity
      priority
      category
      status
      outcome
      acknowledgementDueAt
      acknowledgedAt
      responseDueAt
      resolutionDueAt
      resolvedAt
      messages {
        id
        body
        actorLabel
        createdAt
      }
      events {
        id
        eventType
        createdAt
      }
    }
  }
`

export const UPDATE_CAREBRIDGE_CONCERN_MUTATION = `
  mutation UpdateCarebridgeConcern($input: UpdateConcernStatusInput!) {
    updateCarebridgeConcern(input: $input) {
      id
      status
      outcome
      acknowledgedAt
      resolvedAt
      messages {
        id
        body
        actorLabel
        createdAt
      }
      events {
        id
        eventType
        createdAt
      }
    }
  }
`

export interface CarerListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface CarersQueryResponse {
  carers: CarerListItem[];
}

export const CARERS_QUERY = `
  query Carers {
    carers {
      id
      firstName
      lastName
      email
      phone
    }
  }
`;

export type ShiftVerificationMethod = 'GPS' | 'QR' | 'NFC' | 'PHONE' | 'MANUAL';

export interface ShiftLocationProof {
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  method: ShiftVerificationMethod;
  source?: string | null;
  reasonCode?: string | null;
}

export interface CarerShift {
  id: string;
  carerId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  isActive: boolean;
  clockInProof: ShiftLocationProof;
  clockOutProof?: ShiftLocationProof | null;
  locationConsentAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAnalytics {
  activeCarersNow: number;
  openShiftCount: number;
  clockIns: number;
  clockOuts: number;
  averageShiftMinutes: number;
  clockInMethods: {
    gps: number;
    qr: number;
    nfc: number;
    phone: number;
    manual: number;
  };
  clockOutMethods: {
    gps: number;
    qr: number;
    nfc: number;
    phone: number;
    manual: number;
  };
}

export interface MyActiveShiftQueryResponse {
  myActiveShift: CarerShift | null;
}

export interface MyRecentShiftsQueryResponse {
  myRecentShifts: CarerShift[];
}

export interface ShiftAnalyticsQueryResponse {
  shiftAnalytics: ShiftAnalytics;
}

export interface ClockInMutationResponse {
  clockIn: CarerShift;
}

export interface ClockOutMutationResponse {
  clockOut: CarerShift;
}

export const MY_ACTIVE_SHIFT_QUERY = `
  query MyActiveShift {
    myActiveShift {
      id
      carerId
      clockInAt
      clockOutAt
      isActive
      clockInProof {
        latitude
        longitude
        accuracyMeters
        method
        source
        reasonCode
      }
      clockOutProof {
        latitude
        longitude
        accuracyMeters
        method
        source
        reasonCode
      }
      locationConsentAt
      notes
      createdAt
      updatedAt
    }
  }
`;

export const MY_RECENT_SHIFTS_QUERY = `
  query MyRecentShifts($take: Int) {
    myRecentShifts(take: $take) {
      id
      carerId
      clockInAt
      clockOutAt
      isActive
      clockInProof {
        method
        source
        reasonCode
      }
      clockOutProof {
        method
        source
        reasonCode
      }
      locationConsentAt
      notes
      createdAt
      updatedAt
    }
  }
`;

export const SHIFT_ANALYTICS_QUERY = `
  query ShiftAnalytics($from: String, $to: String) {
    shiftAnalytics(from: $from, to: $to) {
      activeCarersNow
      openShiftCount
      clockIns
      clockOuts
      averageShiftMinutes
      clockInMethods {
        gps
        qr
        nfc
        phone
        manual
      }
      clockOutMethods {
        gps
        qr
        nfc
        phone
        manual
      }
    }
  }
`;

export const CLOCK_IN_MUTATION = `
  mutation ClockIn($input: ClockInInput) {
    clockIn(input: $input) {
      id
      carerId
      clockInAt
      clockOutAt
      isActive
      clockInProof {
        latitude
        longitude
        accuracyMeters
        method
        source
        reasonCode
      }
      locationConsentAt
      notes
      createdAt
      updatedAt
    }
  }
`;

export const CLOCK_OUT_MUTATION = `
  mutation ClockOut($input: ClockOutInput) {
    clockOut(input: $input) {
      id
      carerId
      clockInAt
      clockOutAt
      isActive
      clockInProof {
        method
      }
      clockOutProof {
        latitude
        longitude
        accuracyMeters
        method
        source
        reasonCode
      }
      locationConsentAt
      notes
      createdAt
      updatedAt
    }
  }
`;
