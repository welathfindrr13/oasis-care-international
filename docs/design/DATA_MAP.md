# Data Integration Map

## Overview
This document outlines the real data integration for the Oasis Care frontend application, including which endpoints are connected and which are still pending.

## Real Data Connections

### Dashboard Metrics
**Connected:**
- ✅ **Visits Booked**: `/api/stats/today` → `booked` field
- ✅ **Visits Finished**: `/api/stats/today` → `finished` field

**Pending Backend Endpoints:**
- ⏳ **Carers on Duty**: Requires new backend endpoint 
- ⏳ **Med Alerts**: Requires new backend endpoint

### Visits Page
**Connected:**
- ✅ **Visits List**: GraphQL `/graphql` → `visits` query
  - Supports filtering by date, carerId, status
  - Includes pagination (limit/offset)
  - Returns visit details with carer and client information

## API Endpoints Used

### REST Endpoints
```
GET /api/stats/today
Response: { booked: number, finished: number }
```

### GraphQL Endpoints  
```graphql
query Visits($date: String, $carerId: ID, $status: VisitStatus, $limit: Int, $offset: Int) {
  visits(date: $date, carerId: $carerId, status: $status, limit: $limit, offset: $offset) {
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
```

## Data Types

### Visit Status Values
From Prisma schema (`VisitStatus` enum):
- `SCHEDULED` - Visit is scheduled
- `IN_PROGRESS` - Visit is currently happening  
- `COMPLETED` - Visit has been completed
- `CANCELLED` - Visit has been cancelled

### Filter Parameters
- **date**: ISO date string (YYYY-MM-DD)
- **carerId**: UUID of the carer
- **status**: One of the VisitStatus enum values
- **limit**: Number of items to return (default: 25)
- **offset**: Number of items to skip for pagination

## Frontend Implementation

### Files Created/Modified
```
apps/web/lib/time.ts - London timezone utilities
apps/web/lib/graphql/client.ts - GraphQL client 
apps/web/lib/graphql/queries.ts - Query definitions and types
apps/web/app/api/graphql/route.ts - GraphQL proxy route
apps/web/app/dashboard/page.tsx - Real stats integration
apps/web/app/dashboard/loading.tsx - Loading skeleton
apps/web/app/dashboard/error.tsx - Error boundary
apps/web/app/visits/page.tsx - Real visits data integration
```

### Environment Variables Required
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000  # Backend GraphQL/REST API URL
```

## Development Commands

### Start Development Server
```bash
pnpm -w dev
```

### Test Routes
- Dashboard: http://localhost:3000/dashboard
- Visits: http://localhost:3000/visits

### Build Application  
```bash
pnpm -w build
```

## Authentication
All API requests are authenticated via cookies forwarded through Next.js API routes to maintain session state.

## Timezone Handling
All dates and times are displayed in Europe/London timezone using the utilities in `apps/web/lib/time.ts`.

## Error Handling
- GraphQL errors are logged and fallback to empty data
- Dashboard shows placeholder badges for missing backend endpoints
- Visits page shows empty state when no data is available
- Server components include loading and error boundaries
