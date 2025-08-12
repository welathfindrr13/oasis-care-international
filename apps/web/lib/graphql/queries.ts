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
  date?: string;
  carerId?: string;
  status?: keyof VisitStatus;
  limit?: number;
  offset?: number;
}

/**
 * Query to fetch visits with filtering and pagination
 */
export const VISITS_QUERY = `
  query Visits($date: String, $carerId: ID, $status: VisitStatus, $limit: Int, $offset: Int) {
    visits(
      date: $date
      carerId: $carerId 
      status: $status
      limit: $limit
      offset: $offset
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
 * Calculate offset from page number
 */
export function getOffsetFromPage(page: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  return Math.max(0, (page - 1) * pageSize);
}

/**
 * Calculate total pages from total count
 */
export function getTotalPages(totalCount: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  return Math.ceil(totalCount / pageSize);
}
