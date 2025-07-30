# Oasis International Care

A domiciliary care management platform built with NestJS, Prisma, GraphQL, and Next.js.

## Architecture

- **Monorepo** structure with pnpm workspaces
- **Backend**: NestJS with GraphQL API
- **Frontend**: Next.js with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based with role-based access control

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- pnpm package manager

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run database migrations
cd libs/db && npx prisma migrate deploy
```

### Development

```bash
# Start all services
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build
```

## Error Handling

All API errors return JSON with a structured format:

```json
{
  "code": "VISIT_OVERLAP",
  "message": "Carer already has a visit scheduled during this time period",
  "timestamp": "2025-07-30T12:34:56Z",
  "path": "/graphql"
}
```

### Error Codes

- **Business Errors**
  - `VISIT_OVERLAP` - Carer has conflicting visits
  - `VISIT_NOT_FOUND` - Visit doesn't exist
  - `TASK_NOT_FOUND` - Task doesn't exist
  
- **Authentication/Authorization**
  - `UNAUTHORIZED` - Authentication required
  - `FORBIDDEN` - Insufficient permissions
  - `FORBIDDEN_OWN_RESOURCE_ONLY` - Can only access own resources
  - `FORBIDDEN_READ_ONLY` - Write access denied
  - `INVALID_ROLE` - Invalid user role
  
- **System Errors**
  - `VALIDATION_FAILED` - Input validation failed
  - `INTERNAL_ERROR` - Unexpected server error

### PII Protection

Error messages are automatically scrubbed for:
- Email addresses (e.g., `john.doe@example.com` → `j***@example.com`)
- UK phone numbers (e.g., `07911 123 456` → `07*** *** ***`)

This ensures sensitive information is never exposed in logs or API responses.

## API Documentation

GraphQL playground available at: http://localhost:4000/graphql

REST endpoints:
- `GET /stats/today` - Today's activity statistics (admin only)

## Project Structure

```
apps/
├── api/          # NestJS backend
└── web/          # Next.js frontend

libs/
├── auth/         # Authentication library
└── db/           # Database and Prisma
```

## Testing

The project includes comprehensive test coverage:
- Unit tests for all services
- E2E tests with Testcontainers
- GraphQL resolver tests
- PII masking validation

Run tests with:
```bash
pnpm turbo run test
```

### Logging & Redaction
* **Dev**: colourised pretty logs.  
* **Prod**: one-line JSON suitable for Stackdriver / Loki.  
* Redacts auth headers, cookies, e-mails, UK mobile numbers, and runs every message through `Masker` for belt-and-braces PII stripping.  
* Every line carries `reqId` so traces can be correlated across services.

## License

Private - All rights reserved
