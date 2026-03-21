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
  status?: keyof VisitStatus;
  skip?: number;
  take?: number;
}

/**
 * Query to fetch visits with filtering and pagination
 */
export const VISITS_QUERY = `
  query Visits($scheduledStartFrom: String, $scheduledStartTo: String, $carerId: ID, $status: VisitStatus, $skip: Int, $take: Int) {
    visits(
      scheduledStartFrom: $scheduledStartFrom
      scheduledStartTo: $scheduledStartTo
      carerId: $carerId 
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

export const CARERS_QUERY = `
  query Carers($activeOnly: Boolean) {
    carers(activeOnly: $activeOnly) {
      id
      firstName
      lastName
      email
      phone
    }
  }
`;

export interface UpdateVisitMutationResponse {
  updateVisit: Pick<Visit, 'id' | 'status' | 'actualStart' | 'actualEnd' | 'updatedAt'>;
}

export const UPDATE_VISIT_MUTATION = `
  mutation UpdateVisit($input: UpdateVisitInput!) {
    updateVisit(input: $input) {
      id
      status
      actualStart
      actualEnd
      updatedAt
    }
  }
`;
