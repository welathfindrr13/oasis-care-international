# Data Integration Map

## Overview
This document tracks the active data paths that the current Oasis Care staging app depends on. It is intentionally brief and focuses on the routes and contracts that are still live.

## Current Runtime Paths

### Authentication
- Hosted Cognito login via NextAuth
- App session and role checks handled in the web app
- Hosted Cognito logout route:
  - `/api/auth/cognito-logout`

### Dashboard
- Stats loaded through the web proxy:
  - `GET /api/stats/today`
- Dashboard still includes some placeholder operational counts for admin-facing summary cards

### Visits
- Visits list and visit detail use GraphQL through the web proxy:
  - `POST /api/graphql`
- Current visits query supports:
  - `scheduledStartFrom`
  - `scheduledStartTo`
  - `carerId`
  - `clientId`
  - `status`
  - `skip`
  - `take`
- Carer visit progress is backed by `updateVisit`
  - `SCHEDULED -> IN_PROGRESS`
  - `IN_PROGRESS -> COMPLETED`

### Clients
- Client list uses GraphQL:
  - `clients(skip, take, search)`
- Client detail uses GraphQL:
  - `client(id)`
- Client pages are admin-only in the web app

### eMAR
- eMAR page fetches medication data by date
- Current working path prefers direct API access with the session token and falls back to:
  - `GET /api/emar?date=YYYY-MM-DD`

### Metrics
- Admin metrics page uses:
  - `GET /api/metrics`

## Active GraphQL Shapes

### Visits
```graphql
query Visits(
  $scheduledStartFrom: String
  $scheduledStartTo: String
  $carerId: ID
  $clientId: ID
  $status: VisitStatus
  $skip: Int
  $take: Int
) {
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
      carer { id firstName lastName email phone }
      client { id fullName addressLine1 addressLine2 city postcode }
      tasks { id taskName description isCompleted completedAt notes createdAt updatedAt }
      createdAt
      updatedAt
    }
    total
  }
}
```

### Client
```graphql
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
```

## Notes
- AI summary UI routes are intentionally disabled in staging until the summary pipeline is rebuilt on the new Bedrock Haiku runtime.
- Historical connectivity incident notes were removed from this document because they no longer describe the live staging system.
