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

export interface MedicationAdministration {
  id: string;
  prescriptionId: string;
  visitId?: string;
  scheduledTime: string;
  administeredTime?: string;
  administeredBy?: string;
  status: string;
  notes?: string;
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
  client: Client;
}

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
      administeredTime
      administeredBy
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
