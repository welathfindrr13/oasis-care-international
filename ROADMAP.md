# Oasis International Care - Implementation Roadmap

## 📋 Overview

Domiciliary care platform managing home visits, scheduling, task tracking, and role-based access for carers, clients, and administrators.

## 🏗️ Architecture

### Tech Stack
- **Framework**: NestJS 10 (monorepo with pnpm)
- **Database**: PostgreSQL 16 + Prisma 5
- **API**: GraphQL (Code-First)
- **Auth**: Keycloak OIDC/JWT
- **Testing**: Jest + Testcontainers (90%+ coverage)

### Project Structure
```
oasis-international-care/
├── apps/
│   ├── api/              # NestJS backend
│   └── web/              # Next.js frontend
└── libs/
    ├── db/               # Prisma + migrations
    └── auth/             # JWT strategy + guards
```

## 📊 Core Entities

1. **carer** - Healthcare professionals
2. **client** - Care recipients  
3. **visit** - Scheduled care visits
4. **visit_task** - Tasks during visits

## 🔧 Stage 1: Visit Module (COMPLETED ✅)

### Features
- CRUD operations for visits with GraphQL
- Overlap prevention for carer scheduling
- Role-based access control (Admin/Carer/Client)
- Task completion tracking
- Soft delete support

### Business Rules
- **RBAC**: Admins (full access), Carers (own visits), Clients (read-only)
- **Scheduling**: No overlapping visits per carer
- **Tasks**: Only assigned carer/admin can complete

### Testing
- 40+ unit tests across service/resolver/repository layers
- 11 E2E tests covering all scenarios
- 100% business logic coverage

## 🎯 Stage 2: Activity Dashboard (COMPLETED ✅)

### Backend (NestJS)
- **StatsModule**: Admin-only REST endpoint
- `GET /stats/today`: Returns visits booked/finished today
- Europe/London timezone-aware counting with Luxon

### Frontend (Next.js)
- Live activity page at `/activity`
- Auto-refresh every 30 seconds with SWR
- Responsive stat cards with Tailwind CSS

## 🛡️ Stage 3: Error Handling System (COMPLETED ✅)

### Overview
Comprehensive error handling with custom error codes, PII masking, and consistent responses across REST/GraphQL.

### Implementation
1. **Custom Error Classes**
   - `BaseHttpException` with error codes
   - Type-safe error code enum
   - Proper HTTP status mapping

2. **PII Masking Utility**
   - Masks UK phone numbers: `07911 123 456` → `07*** *** ***`
   - Masks emails: `john.doe@example.com` → `j***@example.com`
   - Protects sensitive data in logs/responses

3. **Exception Filters**
   - **HttpExceptionFilter**: REST endpoints with context type guard
   - **GraphQLExceptionFilter**: GraphQL error formatting
   - Proper filter ordering to avoid conflicts

4. **Error Codes**
   ```typescript
   enum ErrorCode {
     INTERNAL_ERROR = 'INTERNAL_ERROR',
     VALIDATION_FAILED = 'VALIDATION_FAILED',
     FORBIDDEN = 'FORBIDDEN',
     VISIT_NOT_FOUND = 'VISIT_NOT_FOUND',
     VISIT_OVERLAP = 'VISIT_OVERLAP',
     TASK_NOT_FOUND = 'TASK_NOT_FOUND',
   }
   ```

### Key Files
```
apps/api/src/common/
├── errors/
│   ├── base-http.exception.ts
│   └── error-codes.ts
├── filters/
│   ├── http-exception.filter.ts
│   ├── gql-exception.filter.ts
│   └── __tests__/
└── utils/
    ├── masker.ts
    └── __tests__/
```

### Results
- ✅ All 52 tests passing (fixed 2 GraphQL context issues)
- ✅ Consistent error responses across REST/GraphQL
- ✅ PII protection in all error messages
- ✅ Centralized error handling with proper logging

## 🚀 Quick Start

```bash
# Install
pnpm install

# Database setup
cd libs/db && npx prisma migrate deploy

# Run tests
pnpm turbo run test

# Start dev
pnpm --filter @oasis/api dev
pnpm --filter @oasis/web dev
```

## 🔒 Security Features

1. JWT authentication with role validation
2. Input validation via class-validator
3. SQL injection protection (Prisma)
4. PII masking in errors/logs
5. Soft deletes for audit trails

## 🔮 Future Enhancements

1. **Stage 4**: Real-time updates with GraphQL subscriptions
2. **Stage 5**: Geolocation tracking for visit verification
3. **Stage 6**: Push notifications for upcoming visits
4. **Stage 7**: Analytics dashboard with care metrics
5. **Stage 8**: React Native mobile app

## 📝 Key Learnings

- **Monorepo Benefits**: Shared types/utilities across packages
- **Error Handling**: Importance of context-aware exception filters
- **Testing Strategy**: Mock guards properly in E2E tests
- **Clean Architecture**: Clear separation (resolver → service → repository)
- **Type Safety**: End-to-end types with TypeScript + Prisma + GraphQL

---

Last Updated: 30/07/2025 - Stage 3 Error Handling Complete
