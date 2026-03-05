# Report 00: Project Inventory & Tech Stack

**Generated:** 2025-10-25T13:11:21Z  
**Environment:** Phase-5-stable  
**Monorepo Version:** feat/staging-live-setup @ 3afe37a

## Executive Summary

Oasis International Care is a full-stack domiciliary care management platform built as a **pnpm monorepo** using modern TypeScript tooling. The architecture follows a clear separation between backend API services (NestJS + GraphQL + PostgreSQL) and frontend web application (Next.js 14 App Router + Tailwind CSS). The project leverages Turborepo for optimized build orchestration and includes comprehensive infrastructure-as-code for AWS deployment.

This report provides a complete inventory of the monorepo structure, technology stack versions, workspace organization, and build toolchain configuration.

## Monorepo Structure

### High-Level Layout

```
oasis-international-care/
├── apps/                    # Application workspaces
│   ├── api/                # NestJS GraphQL API backend
│   └── web/                # Next.js 14 frontend web app
├── libs/                    # Shared library packages
│   ├── auth/               # JWT auth & guards library
│   └── db/                 # Prisma ORM & database client
├── infrastructure/          # Terraform IaC for AWS
│   ├── staging/            # Staging environment config
│   └── scripts/            # Deployment automation
├── scripts/                 # Build & utility scripts
│   ├── docs/               # Documentation generators
│   └── seed/               # Database seeding
├── cypress/                 # E2E test suite
├── demo/                    # Local demo environments
├── docs/                    # Technical documentation
├── design/                  # Design tokens & Figma sync
├── ops/                     # Operational tooling (Docker)
├── _reports/               # Generated documentation
└── _generated/             # Generated artifacts & data
```

### Workspace Organization

The monorepo uses **pnpm workspaces** with the following structure:

| Workspace | Path | Type | Purpose |
|-----------|------|------|---------|
| `@oasis/api` | `apps/api/` | **Application** | NestJS GraphQL + REST API backend |
| `@oasis/web` | `apps/web/` | **Application** | Next.js 14 frontend web application |
| `@oasis/auth` | `libs/auth/` | **Library** | JWT authentication & authorization guards |
| `@oasis/db` | `libs/db/` | **Library** | Prisma ORM client & database utilities |

**Workspace Configuration:**
- Defined in `pnpm-workspace.yaml`: `apps/*`, `libs/*`
- Package manager: **pnpm v9.13.1** (strict mode, no phantom dependencies)
- Workspace protocol used for internal dependencies

## Technology Stack

### Core Runtime & Languages

| Technology | Version | Usage |
|------------|---------|-------|
| **Node.js** | v22.14.0 | JavaScript runtime (LTS) |
| **TypeScript** | ^5.3.3 | Primary development language |
| **pnpm** | 9.13.1 | Package manager & workspace tool |

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | ^10.x | Backend framework with dependency injection |
| **GraphQL** | Latest | Primary API query language (via Apollo) |
| **Prisma** | ^5.x | Type-safe ORM & migration tool |
| **PostgreSQL** | 16+ | Primary database (with pgvector extension) |
| **JWT** | Latest | Authentication tokens via Passport |
| **Pino** | ^9.7.0 | High-performance structured logging |
| **Prometheus** | ^15.1.3 | Metrics collection (via prom-client) |

**NestJS Modules:**
- `@nestjs/core`, `@nestjs/common` - Core framework
- `@nestjs/graphql` + `@apollo/server` - GraphQL server
- `@nestjs/passport` + `passport-jwt` - Authentication
- `nestjs-cls` - Request context (CLS)
- `nestjs-pino` - Logging integration

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.x | React framework with App Router |
| **React** | 18.x | UI library |
| **Tailwind CSS** | ^3.x | Utility-first CSS framework |
| **TypeScript** | ^5.3.3 | Type safety for components |
| **Apollo Client** | Latest | GraphQL client for data fetching |
| **NextAuth.js** | Latest | Authentication for Next.js |

**UI & Styling:**
- Tailwind CSS with custom design tokens
- Custom component library in `components/ui/`
- Design system integration with Figma

### Database & Data Layer

| Component | Technology | Details |
|-----------|------------|---------|
| **ORM** | Prisma 5.x | Schema-first with type generation |
| **Database** | PostgreSQL 16+ | Primary data store |
| **Vector Search** | pgvector | AI embedding storage for health summaries |
| **Migrations** | Prisma Migrate | Version-controlled schema changes |
| **Seeding** | Custom scripts | Demo & staging data population |

**Prisma Configuration:**
- Output: `libs/db/src/generated/client`
- Binary targets: `native`, `linux-musl-openssl-3.0.x` (for containers)
- Preview features: `postgresqlExtensions` (for pgvector)

### Build & Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Turborepo** | ^2.1.0 | Monorepo build orchestration |
| **ESLint** | ^8.56.0 | Code linting |
| **Prettier** | ^3.2.0 | Code formatting |
| **Jest** | ^29.x | Unit testing framework |
| **Cypress** | ^13.x | E2E testing |
| **Testcontainers** | 10.4.0 | Integration test infrastructure |

**Turborepo Pipeline:**
- Parallel task execution with dependency awareness
- Caching for `build`, `test`, `lint` tasks
- Configuration in `turbo.json`

### Infrastructure & Deployment

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization (multi-stage builds) |
| **Terraform** | Infrastructure as Code (AWS) |
| **AWS ECS Fargate** | Container orchestration |
| **AWS RDS** | Managed PostgreSQL database |
| **AWS ALB** | Application load balancer |
| **AWS Secrets Manager** | Secrets & env variable storage |
| **GitHub Actions** | CI/CD pipelines |

**AWS Stack (Staging - eu-west-2):**
- ECS Fargate with 2 services (API + Web)
- RDS PostgreSQL 15.6 (db.t3.micro)
- ALB with HTTPS (ACM certificates)
- CloudWatch logging & alarms
- See Report 08 for complete infrastructure details

## File System Inventory

### Applications (`apps/`)

#### API Backend (`apps/api/`)

**Key Directories:**
- `src/` - Source code (TypeScript)
  - `visit/` - Visit management module
  - `medication/` - eMAR (electronic Medication Administration Record)
  - `ai-summary/` - AI-powered health summary generation
  - `stats/` - Statistics & reporting
  - `gdpr/` - GDPR compliance (consent, SAR, erasure)
  - `health/` - Health check endpoints
  - `logger/` - Structured logging setup
  - `metrics/` - Prometheus metrics
  - `common/` - Shared utilities (errors, filters, guards)
- `test/` - E2E test suite
- `prompts/` - AI prompt templates

**Configuration Files:**
- `nest-cli.json` - NestJS CLI configuration
- `tsconfig.json` - TypeScript compiler options
- `jest.config.js` - Jest test configuration
- `.env.development`, `.env.test`, `.env.production.example` - Environment templates

**Build Artifacts:**
- `dist/` - Compiled JavaScript output
- `coverage/` - Test coverage reports

#### Web Frontend (`apps/web/`)

**Key Directories:**
- `app/` - Next.js 14 App Router pages
  - `dashboard/` - Main dashboard
  - `visits/` - Visit management UI
  - `clients/` - Client profile pages
  - `emar/` - Medication administration UI
  - `admin/` - Admin tools & metrics
  - `activity/` - Activity tracking
  - `api/` - API route handlers (Next.js routes)
- `components/` - React components
  - `ui/` - Base UI components (Button, Card, etc.)
  - `oasis/` - Domain-specific components
  - `HealthSummary/` - AI summary components
- `lib/` - Utility libraries
  - `graphql/` - GraphQL client & queries
  - `api.ts` - API client utilities
- `styles/` - Global styles & design tokens

**Configuration:**
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS setup
- `postcss.config.js` - PostCSS plugins
- `.eslintrc.json` - ESLint rules

### Libraries (`libs/`)

#### Authentication Library (`libs/auth/`)

**Exports:**
- `JwtStrategy` - Passport JWT strategy
- `RolesGuard` - Role-based access control
- Auth decorators & utilities

**Dependencies:**
- `@nestjs/passport`, `passport-jwt`
- Shared across API modules

#### Database Library (`libs/db/`)

**Structure:**
- `prisma/` - Database schema & migrations
  - `schema.prisma` - Data model definition
  - `migrations/` - Migration history (15+ models)
  - `seed.ts` - Seeding script
- `src/` - ORM client exports
  - `prisma.service.ts` - Prisma service wrapper
  - `db.module.ts` - NestJS module
  - `generated/client/` - Auto-generated Prisma client

**Key Models:** (15 total)
- Care: `Carer`, `Client`, `Visit`, `VisitTask`
- Medications: `Medication`, `Prescription`, `MedicationAdministration`, `MedicationAudit`
- AI/ML: `LogEmbedding`, `HealthSummary`
- GDPR: `ConsentRecord`, `AuditLog`, `RetentionPolicy`, `ErasureQueue`
- Config: `Organization`

### Infrastructure (`infrastructure/`)

**Terraform Configuration:**
- `staging/` - Staging environment IaC
  - `*.tf` files - Resource definitions (VPC, ECS, RDS, ALB, etc.)
  - `backend.tf` - S3 state backend
  - `variables.tf` - Input variables
  - `outputs.tf` - Exported values
- `scripts/` - Deployment automation
  - `deploy-staging.sh` - Deploy workflow
  - `docker-deploy.sh` - Container builds
  - `run-migration.sh` - Database migrations
  - `smoke-test.sh` - Post-deploy validation

### Supporting Directories

| Directory | Purpose |
|-----------|---------|
| `scripts/` | Build, test, and documentation scripts |
| `docs/` | Technical documentation & guides |
| `design/` | Design tokens & Figma sync artifacts |
| `demo/` | Docker Compose for local development |
| `cypress/` | E2E test specifications |
| `ops/` | Operational tools (pgvector Docker image) |
| `test-results/` | CI test outputs |
| `audit/` | Frontend quality audits (a11y, perf, brand) |
| `figma-audit/` | Figma design sync reports |

## Build System Configuration

### Turborepo (`turbo.json`)

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false
    }
  }
}
```

**Pipeline Characteristics:**
- Parallel execution with dependency resolution
- Build caching for faster incremental builds
- Dev mode runs without caching (hot reload)

### TypeScript Configuration

**Root `tsconfig.json`:**
- Strict mode enabled
- ES2022 target
- Path aliases: `@oasis/*` for workspace packages

**Workspace-specific configs:**
- `apps/api/tsconfig.json` - API-specific settings
- `apps/web/tsconfig.json` - Next.js-specific settings
- `libs/*/tsconfig.json` - Library compilation settings

### Package Manager Settings

**pnpm Configuration:**
- Workspace protocol for internal deps
- Strict peer dependencies
- Shared lockfile (`pnpm-lock.yaml`)
- Node version: >=20.0.0 (specified in `package.json`)

## Development Workflow

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start all services in dev mode |
| `pnpm build` | Build all workspaces |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all workspaces |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |

### Local Development Setup

**Prerequisites:**
- Node.js 22.14.0+
- pnpm 9.13.1+
- PostgreSQL 16+ (or Docker)
- Docker (for demo mode)

**Quick Start:**
```bash
# Install dependencies
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run migrations
cd libs/db && npx prisma migrate deploy

# Start services
pnpm dev
```

**Services Running:**
- API: http://localhost:4000 (GraphQL Playground)
- Web: http://localhost:3000
- Database: localhost:5432

## Code Organization Conventions

### Naming Patterns

- **Modules:** PascalCase (e.g., `VisitModule`, `MedicationModule`)
- **Services:** PascalCase with `.service.ts` suffix
- **Controllers:** PascalCase with `.controller.ts` suffix
- **Resolvers:** PascalCase with `.resolver.ts` suffix (GraphQL)
- **DTOs:** PascalCase with `.dto.ts` or `.input.ts` suffix
- **Tests:** Co-located with source (`.spec.ts` for unit, `.e2e-spec.ts` for E2E)

### Directory Structure Patterns

**NestJS Modules (API):**
```
src/module-name/
├── module-name.module.ts      # Module definition
├── module-name.service.ts     # Business logic
├── module-name.resolver.ts    # GraphQL resolver
├── module-name.controller.ts  # REST controller (optional)
├── module-name.repository.ts  # Data access layer
├── dto/                       # Data transfer objects
│   ├── create-*.input.ts
│   ├── update-*.input.ts
│   └── *.dto.ts
└── __tests__/                 # Unit tests
    └── *.spec.ts
```

**Next.js Pages (Web):**
```
app/route-name/
├── page.tsx                   # Route page component
├── layout.tsx                 # Route layout (optional)
├── loading.tsx                # Loading state
├── error.tsx                  # Error boundary
└── __tests__/                 # Component tests
    └── *.test.tsx
```

## Technology Version Matrix

### Backend Dependencies (Notable)

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/core` | ^10.x | NestJS framework |
| `@nestjs/graphql` | ^12.x | GraphQL integration |
| `@prisma/client` | ^5.x | Database ORM |
| `pino` | ^9.7.0 | Logging |
| `prom-client` | ^15.1.3 | Metrics |
| `passport-jwt` | ^4.x | JWT auth |
| `class-validator` | ^0.14.x | DTO validation |
| `graphql` | ^16.x | GraphQL engine |

### Frontend Dependencies (Notable)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.x | Next.js framework |
| `react` | 18.x | UI library |
| `react-dom` | 18.x | React DOM renderer |
| `tailwindcss` | ^3.x | CSS framework |
| `@apollo/client` | ^3.x | GraphQL client |
| `next-auth` | ^4.x | Authentication |

### Development Dependencies (Root)

| Package | Version | Purpose |
|---------|---------|---------|
| `turbo` | ^2.1.0 | Monorepo orchestration |
| `typescript` | ^5.3.3 | Type system |
| `eslint` | ^8.56.0 | Linting |
| `prettier` | ^3.2.0 | Formatting |
| `jest-junit` | ^16.0.0 | Test reporting |
| `testcontainers` | 10.4.0 | Integration tests |
| `playwright` | ^1.54.2 | E2E testing (alternative) |

## Security & Compliance Notes

### Environment Variable Management

**Development:** Local `.env` files (gitignored)  
**Staging/Production:** AWS Secrets Manager  
**CI/CD:** GitHub Secrets

**Critical Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Authentication token signing key
- `NEXTAUTH_SECRET` - NextAuth session encryption
- All secrets masked in logs via custom masker utility

### Data Protection

- **PII Masking:** Email and phone numbers automatically redacted in logs
- **GDPR Module:** Consent tracking, Subject Access Requests, Right to Erasure
- **Audit Logging:** All data access/modifications logged to `audit_log` table

### Infrastructure Security

- VPC with private subnets for database
- Security groups restrict network access
- Secrets never committed to version control
- IAM roles with least-privilege permissions
- See Report 08 for detailed infrastructure security

## Related Documentation

- **Report 01:** Packages & Scripts - Detailed dependency analysis
- **Report 02:** Frontend Overview - Next.js architecture & routes
- **Report 03:** API Architecture - Backend module details
- **Report 04:** Database Schema - Prisma models & relationships
- **Report 08:** Terraform Infrastructure - Complete AWS setup

## Quick Reference

### Repository Info

- **GitHub:** https://github.com/welathfindrr13/oasis-care-international
- **Current Branch:** feat/staging-live-setup
- **Latest Commit:** 3afe37a
- **Node Version:** v22.14.0
- **Package Manager:** pnpm 9.13.1

### Key Contacts & Links

- **API GraphQL Playground:** http://localhost:4000/graphql (dev)
- **Web Application:** http://localhost:3000 (dev)
- **Staging API:** https://api.oasis-care.co (configured, see ENV-Matrix.md)
- **Documentation:** `/docs` directory

### File Counts (Approximate)

- **Total Workspaces:** 4 (2 apps + 2 libs)
- **TypeScript Files:** 500+ (`.ts`, `.tsx`)
- **Database Models:** 15 (Prisma schema)
- **Database Migrations:** 8+ (in `libs/db/prisma/migrations/`)
- **GitHub Actions:** 8 workflows
- **Terraform Resources:** 40+ (AWS infrastructure)

---

**Report End** • Generated from monorepo analysis at commit 3afe37a
