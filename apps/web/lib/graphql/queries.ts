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
  isActive: boolean;
  hireDate?: string;
  upcomingVisitsCount: number;
  completedTodayCount: number;
}

export interface CarersQueryResponse {
  carers: Carer[];
}

export interface Client {
  id: string;
  fullName: string;
  preferredName?: string;
  pronouns?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  dateOfBirth?: string;
  preferredLanguage?: string;
  communicationNeeds?: string;
  accessibilityAdjustments?: string;
  representativeName?: string;
  representativeRelationship?: string;
  representativePhone?: string;
  representativeEmail?: string;
}

export interface CarePlanOverview {
  summary: string;
  strengths: string[];
  preferences: string[];
}

export interface CarePlanGoalsAndOutcomes {
  goals: string[];
  desiredOutcomes: string[];
}

export interface CarePlanDailyRoutines {
  morning: string;
  midday: string;
  evening: string;
  overnight: string;
}

export interface CarePlanPersonalCareSupport {
  bathing: string;
  dressing: string;
  toileting: string;
  grooming: string;
}

export interface CarePlanMobilityAndTransfers {
  mobilitySummary: string;
  transferGuidance: string;
  equipment: string[];
}

export interface CarePlanNutritionAndHydration {
  nutritionSummary: string;
  hydrationSupport: string;
  dietaryNeeds: string[];
}

export interface CarePlanMedicationSupport {
  levelOfSupport: string;
  keyInstructions: string;
  refusalEscalation: string;
}

export interface CarePlanCommunicationAndAccessibility {
  communicationApproach: string;
  communicationNeeds: string[];
  accessibilityAdjustments: string[];
}

export interface CarePlanRiskAndRedFlagItem {
  title: string;
  guidance: string;
  escalationTrigger?: string;
}

export interface CarePlanRisksAndRedFlags {
  items: CarePlanRiskAndRedFlagItem[];
}

export interface CarePlanContingencyAndEscalation {
  summary: string;
  actions: string[];
  escalationTriggers: string[];
}

export interface CarePlanRepresentativesAndInvolvement {
  summary: string;
  involvedPeople: string[];
}

export interface CarePlanContent {
  overview: CarePlanOverview;
  goalsAndOutcomes: CarePlanGoalsAndOutcomes;
  dailyRoutines: CarePlanDailyRoutines;
  personalCareSupport: CarePlanPersonalCareSupport;
  mobilityAndTransfers: CarePlanMobilityAndTransfers;
  nutritionAndHydration: CarePlanNutritionAndHydration;
  medicationSupport: CarePlanMedicationSupport;
  communicationAndAccessibility: CarePlanCommunicationAndAccessibility;
  risksAndRedFlags: CarePlanRisksAndRedFlags;
  contingencyAndEscalation: CarePlanContingencyAndEscalation;
  representativesAndInvolvement: CarePlanRepresentativesAndInvolvement;
}

export interface CarePlanVersion {
  id: string;
  carePlanId: string;
  versionNumber: number;
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
  reviewDueAt?: string;
  effectiveFrom?: string;
  authoredBy: string;
  approvedBy?: string;
  approvedAt?: string;
  content: CarePlanContent;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlan {
  id: string;
  clientId: string;
  activeVersion?: CarePlanVersion | null;
  draftVersion?: CarePlanVersion | null;
  createdAt: string;
  updatedAt: string;
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

export interface MedicationAdministration {
  id: string;
  prescriptionId: string;
  visitId?: string;
  scheduledTime: string;
  administeredTime?: string;
  administeredBy?: string;
  status: string;
  notes?: string;
  instructionSnapshot?: string;
  createdAt: string;
  updatedAt: string;
  prescription?: {
    id: string;
    specialInstructions?: string;
    medication?: {
      id: string;
      name: string;
      dosage: string;
      unit: string;
      instructions?: string;
    };
  };
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  unit: string;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationsQueryResponse {
  medications: {
    items: Medication[];
    total: number;
  };
}

export interface MedicationQueryVariables {
  name?: string;
  skip?: number;
  take?: number;
}

export interface Prescription {
  id: string;
  clientId: string;
  medicationId: string;
  startDate: string;
  endDate?: string;
  frequencyPerDay: number;
  frequencyIntervalHours?: string | number;
  administrationTimes: string[];
  specialInstructions?: string;
  isActive: boolean;
  medication?: Medication;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPrescriptionsQueryResponse {
  clientPrescriptions: Prescription[];
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
  carePlan?: CarePlanVersion | null;
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

export interface VisitQueryResponse {
  visit: Visit;
}

export interface DueMedsQueryResponse {
  listDueMeds: MedicationAdministration[];
}

export interface VisitMedicationsQueryResponse {
  listVisitMedications: MedicationAdministration[];
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

export const VISIT_QUERY = `
  query Visit($id: String!) {
    visit(id: $id) {
      id
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
        preferredName
        pronouns
        addressLine1
        addressLine2
        city
        postcode
        dateOfBirth
        preferredLanguage
        communicationNeeds
        accessibilityAdjustments
        representativeName
        representativeRelationship
        representativePhone
        representativeEmail
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
      carePlan {
        id
        carePlanId
        versionNumber
        status
        reviewDueAt
        effectiveFrom
        authoredBy
        approvedBy
        approvedAt
        content {
          overview {
            summary
            strengths
            preferences
          }
          goalsAndOutcomes {
            goals
            desiredOutcomes
          }
          dailyRoutines {
            morning
            midday
            evening
            overnight
          }
          personalCareSupport {
            bathing
            dressing
            toileting
            grooming
          }
          mobilityAndTransfers {
            mobilitySummary
            transferGuidance
            equipment
          }
          nutritionAndHydration {
            nutritionSummary
            hydrationSupport
            dietaryNeeds
          }
          medicationSupport {
            levelOfSupport
            keyInstructions
            refusalEscalation
          }
          communicationAndAccessibility {
            communicationApproach
            communicationNeeds
            accessibilityAdjustments
          }
          risksAndRedFlags {
            items {
              title
              guidance
              escalationTrigger
            }
          }
          contingencyAndEscalation {
            summary
            actions
            escalationTriggers
          }
          representativesAndInvolvement {
            summary
            involvedPeople
          }
        }
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
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
  client: Client;
}

export interface ClientCarePlanQueryResponse {
  clientCarePlan: CarePlan | null;
}

export interface ClientCarePlanHistoryQueryResponse {
  clientCarePlanHistory: CarePlanVersion[];
}

export const CLIENT_QUERY = `
  query Client($id: String!) {
    client(id: $id) {
      id
      fullName
      preferredName
      pronouns
      addressLine1
      addressLine2
      city
      postcode
      dateOfBirth
      preferredLanguage
      communicationNeeds
      accessibilityAdjustments
      representativeName
      representativeRelationship
      representativePhone
      representativeEmail
    }
  }
`;

/**
 * Query to fetch clients with pagination and search.
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

export const CLIENT_CARE_PLAN_QUERY = `
  query ClientCarePlan($clientId: ID!) {
    clientCarePlan(clientId: $clientId) {
      id
      clientId
      activeVersion {
        id
        carePlanId
        versionNumber
        status
        reviewDueAt
        effectiveFrom
        authoredBy
        approvedBy
        approvedAt
        content {
          overview {
            summary
            strengths
            preferences
          }
          goalsAndOutcomes {
            goals
            desiredOutcomes
          }
          dailyRoutines {
            morning
            midday
            evening
            overnight
          }
          personalCareSupport {
            bathing
            dressing
            toileting
            grooming
          }
          mobilityAndTransfers {
            mobilitySummary
            transferGuidance
            equipment
          }
          nutritionAndHydration {
            nutritionSummary
            hydrationSupport
            dietaryNeeds
          }
          medicationSupport {
            levelOfSupport
            keyInstructions
            refusalEscalation
          }
          communicationAndAccessibility {
            communicationApproach
            communicationNeeds
            accessibilityAdjustments
          }
          risksAndRedFlags {
            items {
              title
              guidance
              escalationTrigger
            }
          }
          contingencyAndEscalation {
            summary
            actions
            escalationTriggers
          }
          representativesAndInvolvement {
            summary
            involvedPeople
          }
        }
        createdAt
        updatedAt
      }
      draftVersion {
        id
        carePlanId
        versionNumber
        status
        reviewDueAt
        effectiveFrom
        authoredBy
        approvedBy
        approvedAt
        content {
          overview {
            summary
            strengths
            preferences
          }
          goalsAndOutcomes {
            goals
            desiredOutcomes
          }
          dailyRoutines {
            morning
            midday
            evening
            overnight
          }
          personalCareSupport {
            bathing
            dressing
            toileting
            grooming
          }
          mobilityAndTransfers {
            mobilitySummary
            transferGuidance
            equipment
          }
          nutritionAndHydration {
            nutritionSummary
            hydrationSupport
            dietaryNeeds
          }
          medicationSupport {
            levelOfSupport
            keyInstructions
            refusalEscalation
          }
          communicationAndAccessibility {
            communicationApproach
            communicationNeeds
            accessibilityAdjustments
          }
          risksAndRedFlags {
            items {
              title
              guidance
              escalationTrigger
            }
          }
          contingencyAndEscalation {
            summary
            actions
            escalationTriggers
          }
          representativesAndInvolvement {
            summary
            involvedPeople
          }
        }
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const CLIENT_CARE_PLAN_HISTORY_QUERY = `
  query ClientCarePlanHistory($clientId: ID!) {
    clientCarePlanHistory(clientId: $clientId) {
      id
      carePlanId
      versionNumber
      status
      reviewDueAt
      effectiveFrom
      authoredBy
      approvedBy
      approvedAt
      createdAt
      updatedAt
    }
  }
`;

export interface CarersQueryVariables {
  activeOnly?: boolean;
  search?: string;
}

export const CARERS_QUERY = `
  query Carers($activeOnly: Boolean, $search: String) {
    carers(activeOnly: $activeOnly, search: $search) {
      id
      firstName
      lastName
      email
      phone
      isActive
      hireDate
      upcomingVisitsCount
      completedTodayCount
    }
  }
`;

export const MEDICATIONS_QUERY = `
  query Medications($name: String, $skip: Int, $take: Int) {
    medications(name: $name, skip: $skip, take: $take) {
      items {
        id
        name
        dosage
        unit
        instructions
        createdAt
        updatedAt
      }
      total
    }
  }
`;

export const CLIENT_PRESCRIPTIONS_QUERY = `
  query ClientPrescriptions($clientId: String!, $activeOnly: Boolean) {
    clientPrescriptions(clientId: $clientId, activeOnly: $activeOnly) {
      id
      clientId
      medicationId
      startDate
      endDate
      frequencyPerDay
      frequencyIntervalHours
      administrationTimes
      specialInstructions
      isActive
      createdAt
      updatedAt
      medication {
        id
        name
        dosage
        unit
        instructions
        createdAt
        updatedAt
      }
    }
  }
`;

export interface UpdateVisitMutationResponse {
  updateVisit: Pick<Visit, 'id' | 'status' | 'actualStart' | 'actualEnd' | 'notes' | 'updatedAt'>;
}

export interface SetVisitTaskCompletionMutationResponse {
  setVisitTaskCompletion: Pick<VisitTask, 'id' | 'isCompleted' | 'completedAt' | 'notes' | 'updatedAt'>;
}

export interface UpdateVisitTaskMutationResponse {
  updateVisitTask: Pick<VisitTask, 'id' | 'isCompleted' | 'completedAt' | 'notes' | 'updatedAt'>;
}

export interface RecordAdministrationMutationResponse {
  recordAdministration: Pick<
    MedicationAdministration,
    'id' | 'status' | 'notes' | 'administeredTime' | 'administeredBy' | 'updatedAt'
  >;
}

export interface CreateMedicationMutationResponse {
  createMedication: Medication;
}

export interface CreatePrescriptionMutationResponse {
  createPrescription: Prescription;
}

export interface UpdatePrescriptionMutationResponse {
  updatePrescription: Prescription;
}

export const UPDATE_VISIT_MUTATION = `
  mutation UpdateVisit($input: UpdateVisitInput!) {
    updateVisit(input: $input) {
      id
      status
      actualStart
      actualEnd
      notes
      updatedAt
    }
  }
`;

export const SET_VISIT_TASK_COMPLETION_MUTATION = `
  mutation SetVisitTaskCompletion($taskId: String!, $isCompleted: Boolean!, $notes: String) {
    setVisitTaskCompletion(taskId: $taskId, isCompleted: $isCompleted, notes: $notes) {
      id
      isCompleted
      completedAt
      notes
      updatedAt
    }
  }
`;

export const UPDATE_VISIT_TASK_MUTATION = `
  mutation UpdateVisitTask($input: UpdateVisitTaskInput!) {
    updateVisitTask(input: $input) {
      id
      isCompleted
      completedAt
      notes
      updatedAt
    }
  }
`;

export const RECORD_ADMINISTRATION_MUTATION = `
  mutation RecordAdministration($input: RecordAdministrationInput!) {
    recordAdministration(input: $input) {
      id
      status
      notes
      instructionSnapshot
      administeredTime
      administeredBy
      updatedAt
    }
  }
`;

export const CREATE_MEDICATION_MUTATION = `
  mutation CreateMedication($input: CreateMedicationInput!) {
    createMedication(input: $input) {
      id
      name
      dosage
      unit
      instructions
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_PRESCRIPTION_MUTATION = `
  mutation CreatePrescription($input: CreatePrescriptionInput!) {
    createPrescription(input: $input) {
      id
      clientId
      medicationId
      startDate
      endDate
      frequencyPerDay
      frequencyIntervalHours
      administrationTimes
      specialInstructions
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PRESCRIPTION_MUTATION = `
  mutation UpdatePrescription($input: UpdatePrescriptionInput!) {
    updatePrescription(input: $input) {
      id
      clientId
      medicationId
      startDate
      endDate
      frequencyPerDay
      frequencyIntervalHours
      administrationTimes
      specialInstructions
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const LIST_DUE_MEDS_QUERY = `
  query ListDueMeds($visitId: String!) {
    listDueMeds(visitId: $visitId) {
      id
      prescriptionId
      visitId
      scheduledTime
      administeredTime
      administeredBy
      status
      notes
      instructionSnapshot
      createdAt
      updatedAt
      prescription {
        id
        specialInstructions
        medication {
          id
          name
          dosage
          unit
          instructions
        }
      }
    }
  }
`;

export const LIST_VISIT_MEDICATIONS_QUERY = `
  query ListVisitMedications($visitId: String!) {
    listVisitMedications(visitId: $visitId) {
      id
      prescriptionId
      visitId
      scheduledTime
      administeredTime
      administeredBy
      status
      notes
      instructionSnapshot
      createdAt
      updatedAt
      prescription {
        id
        specialInstructions
        medication {
          id
          name
          dosage
          unit
          instructions
        }
      }
    }
  }
`;
