# Report 01: Packages & Scripts

**Generated:** 2025-10-25T13:11:21Z  
**Environment:** Phase-5-stable  
**Monorepo Version:** feat/staging-live-setup @ 3afe37a

## Executive Summary

The Oasis Care monorepo uses **pnpm workspaces** with 4 packages: 2 applications (@oasis/api, @oasis/web) and 2 shared libraries (@oasis/auth, @oasis/db). The dependency management strategy emphasizes version alignment across workspaces, with shared dependencies like `@nestjs/*`, `@prisma/client`, and `typescript` maintained at consistent versions. Scripts are organized by purpose (build, test, dev, migrate) and leverage Turborepo for efficient parallel execution.

This report catalogs all dependencies, analyzes npm script patterns, and provides a reference for common development commands.

## Dependency Overview

### Summary Statistics

| Workspace | Total Dependencies | Production | Dev Dependencies |
|-----------|-------------------|------------|------------------|
| **Root** | 9 | 6 | 3 |
| **@oasis/api** | 38 | 19 | 19 |
| **@oasis/web** | 13 | 7 | 6 |
| **@oasis/db** | 4 | 4 | 2 (shared) |
| **@oasis/auth** | ~4 | ~4 | ~2 (shared) |
| **TOTAL** | ~68 unique | ~40 | ~28 |

### Version Alignment

**Critical Shared Versions:**
- TypeScript: `^5.3.3` (all workspaces)
- Node Types: `^20.x` / `20.10.6` (all workspaces)
- NestJS Core: `10.3.0` (api + libs)
- Prisma: `5.8.0` (api + db)
- Next.js: `14.2.5` (web)
- React: `^18.3.1` (web)

## Root Workspace Dependencies

**Location:** `/package.json`

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/pino-http` | ^6.1.0 | TypeScript types for Pino HTTP logger |
| `@types/uuid` | ^10.0.0 | TypeScript types for UUID library |
| `@willsoto/nestjs-prometheus` | ^6.0.2 | Prometheus metrics integration for NestJS |
| `crypto-random-string` | ^5.0.0 | Cryptographically strong random strings |
| `nestjs-pino` | ^4.4.0 | Pino logger integration for NestJS |
| `pino` | ^9.7.0 | High-performance JSON logger |
| `pino-http` | ^10.5.0 | HTTP logger middleware for Pino |
| `pino-pretty` | ^13.1.1 | Pretty-print Pino logs for development |
| `prom-client` | ^15.1.3 | Prometheus client for metrics collection |
| `uuid` | ^11.1.0 | UUID generation library |

**Notes:**
- Logging stack shared across all services (Pino + nestjs-pino)
- Metrics collection via Prometheus client
- UUID utilities for ID generation

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@axe-core/playwright` | ^4.10.2 | Accessibility testing with Playwright |
| `@types/node` | ^20.0.0 | Node.js type definitions |
| `eslint` | ^8.56.0 | JavaScript/TypeScript linter |
| `jest-junit` | ^16.0.0 | Jest JUnit reporter for CI |
| `playwright` | ^1.54.2 | E2E browser automation |
| `prettier` | ^3.2.0 | Code formatter |
| `testcontainers` | 10.4.0 | Docker containers for integration tests |
| `ts-node` | 10.9.2 | TypeScript execution engine |
| `turbo` | ^2.1.0 | Monorepo build orchestrator |
| `typescript` | ^5.3.3 | TypeScript compiler |

## Application Workspaces

### @oasis/api (Backend API)

**Location:** `apps/api/package.json`

#### Production Dependencies (19 total)

**Core Framework:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` | 10.3.0 | NestJS core decorators & utilities |
| `@nestjs/core` | 10.3.0 | NestJS application core |
| `@nestjs/platform-express` | 10.3.0 | Express platform adapter |
| `@nestjs/config` | 3.1.1 | Configuration module |
| `reflect-metadata` | 0.2.1 | Metadata reflection (required by NestJS) |
| `rxjs` | 7.8.1 | Reactive extensions (required by NestJS) |

**GraphQL & API:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/graphql` | 12.0.11 | GraphQL module for NestJS |
| `@nestjs/apollo` | 12.0.11 | Apollo Server integration |
| `@apollo/server` | 4.10.0 | GraphQL server |
| `graphql` | 16.8.1 | GraphQL JavaScript implementation |
| `graphql-type-json` | ^0.3.2 | JSON scalar type for GraphQL |

**Authentication:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/passport` | 10.0.3 | Passport.js integration |
| `@nestjs/jwt` | 10.2.0 | JWT token handling |
| `passport` | 0.7.0 | Authentication middleware |
| `passport-jwt` | 4.0.1 | JWT strategy for Passport |

**Database:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | 5.8.0 | Prisma ORM client |

**Validation & Transformation:**
| Package | Version | Purpose |
|---------|---------|---------|
| `class-transformer` | 0.5.1 | Object transformation & serialization |
| `class-validator` | 0.14.0 | Decorator-based validation |
| `joi` | ^18.0.0 | Schema validation library |

**AWS Integration:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-bedrock-runtime` | ^3.859.0 | AWS Bedrock AI integration |
| `@aws-sdk/client-secrets-manager` | ^3.859.0 | AWS Secrets Manager client |

**Utilities:**
| Package | Version | Purpose |
|---------|---------|---------|
| `nestjs-cls` | 4.0.1 | Continuation-local storage for request context |
| `luxon` | ^3.4.4 | DateTime manipulation library |

#### Development Dependencies (19 total)

**NestJS Tooling:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/cli` | 10.2.1 | NestJS CLI for scaffolding |
| `@nestjs/schematics` | 10.0.3 | Code generation schematics |
| `@nestjs/testing` | 10.3.0 | Testing utilities for NestJS |

**Testing:**
| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | 29.7.0 | Testing framework |
| `ts-jest` | 29.1.1 | TypeScript preprocessor for Jest |
| `supertest` | 6.3.3 | HTTP assertions for testing |
| `testcontainers` | 10.4.0 | Docker containers for tests |
| `@testcontainers/postgresql` | 10.4.0 | PostgreSQL test container |

**TypeScript & Types:**
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 5.3.3 | TypeScript compiler |
| `ts-node` | 10.9.2 | TypeScript execution |
| `@types/node` | 20.10.6 | Node.js type definitions |
| `@types/express` | 4.17.21 | Express type definitions |
| `@types/jest` | 29.5.11 | Jest type definitions |
| `@types/supertest` | 6.0.2 | Supertest type definitions |
| `@types/passport-jwt` | 4.0.0 | Passport JWT type definitions |
| `@types/luxon` | ^3.4.2 | Luxon type definitions |
| `@types/jsonwebtoken` | 9.0.5 | JWT type definitions |

**Utilities:**
| Package | Version | Purpose |
|---------|---------|---------|
| `dotenv` | 16.3.1 | Environment variable loading |
| `cross-env` | 7.0.3 | Cross-platform environment variables |
| `jsonwebtoken` | 9.0.2 | JWT signing/verification (dev/test) |

### @oasis/web (Frontend Web App)

**Location:** `apps/web/package.json`

#### Production Dependencies (7 total)

**Core Framework:**
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.5 | Next.js React framework |
| `react` | ^18.3.1 | React library |
| `react-dom` | ^18.3.1 | React DOM renderer |

**Data Fetching:**
| Package | Version | Purpose |
|---------|---------|---------|
| `swr` | ^2.2.5 | React Hooks for data fetching |

**Authentication:**
| Package | Version | Purpose |
|---------|---------|---------|
| `next-auth` | ^4.24.11 | Authentication for Next.js |

**Utilities:**
| Package | Version | Purpose |
|---------|---------|---------|
| `clsx` | ^2.1.1 | Conditional className utility |
| `tailwind-merge` | ^2.6.0 | Tailwind class merging utility |

**Document Generation:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@react-pdf/renderer` | ^4.3.0 | PDF generation for React |

#### Development Dependencies (6 total)

**Styling:**
| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^3.4.4 | Utility-first CSS framework |
| `autoprefixer` | ^10.4.19 | PostCSS plugin for vendor prefixes |
| `postcss` | ^8.4.38 | CSS transformation tool |

**Linting:**
| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^8 | JavaScript/TypeScript linter |
| `eslint-config-next` | 14.2.5 | Next.js ESLint configuration |

**TypeScript & Types:**
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | TypeScript compiler |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^18 | React type definitions |
| `@types/react-dom` | ^18 | React DOM type definitions |

## Library Workspaces

### @oasis/db (Database & Prisma)

**Location:** `libs/db/package.json`

#### Dependencies (4 total)

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | 5.8.0 | Prisma ORM client (generated) |
| `prisma` | 5.8.0 | Prisma CLI & migration tool |
| `@nestjs/common` | 10.3.0 | NestJS decorators for module |
| `@nestjs/config` | 3.1.1 | Configuration integration |

#### Development Dependencies (2 total)

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 5.3.3 | TypeScript compiler |
| `@types/node` | 20.10.6 | Node.js type definitions |

**Notes:**
- Minimal dependencies focused on Prisma ORM
- Exports generated Prisma client to other workspaces
- NestJS integration for dependency injection

### @oasis/auth (Authentication Library)

**Location:** `libs/auth/package.json`

**Note:** Package.json not fully analyzed in current session, but from code inspection contains:

#### Key Dependencies (Estimated)

- `@nestjs/passport` - Passport integration
- `passport-jwt` - JWT authentication strategy
- `@nestjs/jwt` - JWT token handling
- TypeScript types for authentication

## Script Inventory

### Root Scripts

**Location:** `/package.json`

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `turbo run dev --parallel` | Start all workspaces in dev mode (parallel) |
| `test` | `turbo run test` | Run tests across all workspaces |
| `lint` | `turbo run lint` | Lint all workspaces |
| `build` | `turbo run build` | Build all workspaces |
| `db:generate` | `prisma generate` | Generate Prisma client |
| `db:migrate` | `prisma migrate dev` | Run database migrations (dev) |
| `db:push` | `prisma db push` | Push schema to database |
| `seed:staging` | `ts-node scripts/seed/staging.seed.ts` | Seed staging database |

**Invocation Pattern:**
- Uses Turborepo for workspace orchestration
- Scripts cascade to workspace-specific implementations
- Parallel execution for dev mode

### @oasis/api Scripts

**Location:** `apps/api/package.json`

| Script | Command | Purpose | Type |
|--------|---------|---------|------|
| `build` | `nest build` | Build API to dist/ | **Build** |
| `dev` | `node start-dev.js` | Start API in dev mode (custom script) | **Dev** |
| `dev:watch` | `nest start --watch` | Start API with hot reload | **Dev** |
| `start` | `node dist/apps/api/src/main` | Start production API | **Run** |
| `test` | `jest --passWithNoTests` | Run unit tests | **Test** |
| `test:watch` | `jest --watch` | Run tests in watch mode | **Test** |
| `test:cov` | `jest --coverage` | Run tests with coverage | **Test** |
| `test:e2e` | `cross-env NODE_ENV=test jest --config ./test/jest-e2e.json --runInBand` | Run E2E tests | **Test** |

**Notes:**
- Custom `start-dev.js` script for development setup
- E2E tests run with `--runInBand` (sequential) for database isolation
- Uses `cross-env` for cross-platform env variable setting

### @oasis/web Scripts

**Location:** `apps/web/package.json`

| Script | Command | Purpose | Type |
|--------|---------|---------|------|
| `dev` | `next dev` | Start Next.js dev server | **Dev** |
| `build` | `next build` | Build production bundle | **Build** |
| `start` | `next start` | Start production server | **Run** |
| `lint` | `next lint` | Lint Next.js application | **Lint** |

**Notes:**
- Standard Next.js script pattern
- No custom test scripts (would use root `test` command)
- Simple, convention-based structure

### @oasis/db Scripts

**Location:** `libs/db/package.json`

| Script | Command | Purpose | Type |
|--------|---------|---------|------|
| `prebuild` | `pnpm prisma generate` | Generate Prisma client before build | **Pre-build** |
| `build` | `tsc` | Compile TypeScript | **Build** |
| `generate` | `prisma generate` | Generate Prisma client | **Prisma** |
| `migrate` | `prisma migrate dev` | Create & apply migrations (dev) | **Prisma** |
| `migrate:deploy` | `prisma migrate deploy` | Apply migrations (production) | **Prisma** |
| `studio` | `prisma studio` | Launch Prisma Studio GUI | **Prisma** |

**Notes:**
- `prebuild` hook ensures Prisma client is generated before compilation
- Separate dev (`migrate`) vs production (`migrate:deploy`) migration commands
- Prisma Studio for database visualization

## Common Development Commands

### Getting Started

```bash
# Install all dependencies
pnpm install

# Generate Prisma client (required after schema changes)
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Start all services in development mode
pnpm dev
```

### Development Workflow

```bash
# API development
cd apps/api
pnpm dev              # Start API with custom dev script
pnpm dev:watch        # Start with hot reload
pnpm test:watch       # Run tests in watch mode

# Web development
cd apps/web
pnpm dev              # Start Next.js dev server (port 3000)

# Database operations
cd libs/db
pnpm studio           # Launch Prisma Studio (GUI)
pnpm migrate          # Create new migration
```

### Testing

```bash
# Run all tests (root)
pnpm test

# API-specific tests
cd apps/api
pnpm test             # Unit tests
pnpm test:cov         # With coverage
pnpm test:e2e         # E2E tests with testcontainers
```

### Building & Production

```bash
# Build everything
pnpm build

# Build specific workspace
pnpm --filter @oasis/api build
pnpm --filter @oasis/web build

# Run production builds
cd apps/api && pnpm start
cd apps/web && pnpm start
```

## Script Patterns & Conventions

### Naming Conventions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `dev` | Development mode with hot reload | `next dev`, `nest start --watch` |
| `build` | Production build | `nest build`, `next build` |
| `start` | Run production build | `node dist/main`, `next start` |
| `test` | Run unit tests | `jest` |
| `test:*` | Test variants | `test:watch`, `test:e2e`, `test:cov` |
| `lint` | Code linting | `next lint`, `eslint` |
| `db:*` | Database operations | `db:generate`, `db:migrate`, `db:push` |
| `prebuild` | Pre-build hook | `pnpm prisma generate` |

### Turborepo Integration

**Pipeline Configuration** (from `turbo.json`):

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

**Behavior:**
- `build` tasks run dependencies first (^build)
- `test` requires `build` to complete first
- `dev` never caches (always runs fresh)
- `lint` runs independently

### Environment Variables Required

**API (@oasis/api):**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing key
- `NODE_ENV` - Environment (development/test/production)
- `METRICS_ENABLED` - Enable Prometheus metrics (true/false)
- `GDPR_ENABLED` - Enable GDPR module (true/false)
- AWS credentials (for Bedrock AI & Secrets Manager)

**Web (@oasis/web):**
- `NEXTAUTH_URL` - NextAuth callback URL
- `NEXTAUTH_SECRET` - NextAuth session encryption
- `NEXT_PUBLIC_API_URL` - Backend API URL

**Database (@oasis/db):**
- `DATABASE_URL` - PostgreSQL connection (used by Prisma)

## Dependency Management Best Practices

### Version Pinning Strategy

**Exact Versions:**
- Core NestJS packages: `10.3.0` (no caret)
- Prisma: `5.8.0` (exact version for ORM consistency)
- Apollo Server: `4.10.0` (GraphQL API stability)

**Flexible Versions:**
- TypeScript: `^5.3.3` (allow patch updates)
- React: `^18.3.1` (allow minor updates)
- Development tools: `^` or `~` prefixes

### Workspace Dependencies

**Internal Dependencies** (workspace protocol):
```json
{
  "dependencies": {
    "@oasis/db": "workspace:*",
    "@oasis/auth": "workspace:*"
  }
}
```

### Update Strategy

```bash
# Check for outdated packages
pnpm outdated

# Update specific package
pnpm update <package-name>

# Update all minor/patch versions
pnpm update --latest
```

## Missing Scripts & Gaps

### Identified Gaps

1. **No root-level E2E test command**
   - Individual workspaces have tests, but no unified E2E runner
   - Recommendation: Add `test:e2e` script to root

2. **No type-checking script**
   - While build includes type-checking, standalone check would be useful
   - Recommendation: Add `typecheck` script: `turbo run typecheck`

3. **No format script at root**
   - Prettier is installed but no format command
   - Recommendation: Add `format` and `format:check` scripts

4. **Web app has no test script**
   - Frontend lacks testing infrastructure
   - Recommendation: Add Jest + React Testing Library

5. **No deployment scripts in package.json**
   - Deployment handled by shell scripts in `/infrastructure`
   - Could benefit from npm script wrappers

### Recommended Additions

**Root package.json:**
```json
{
  "scripts": {
    "typecheck": "turbo run typecheck",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test:e2e": "turbo run test:e2e",
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
```

## Dependency Security

### Security Considerations

- **AWS SDK packages**: Keep updated for security patches
- **Authentication packages**: Critical security updates for passport/jwt
- **Database packages**: Prisma security updates important
- **Next.js**: Monitor for security advisories

### Audit Commands

```bash
# Check for vulnerabilities
pnpm audit

# Fix auto-fixable issues
pnpm audit --fix

# Generate audit report
pnpm audit --json > audit-report.json
```

## Related Documentation

- **Report 00:** Project Inventory & Tech Stack - Technology versions
- **Report 02:** Frontend Overview - Web app structure
- **Report 03:** API Architecture - Backend modules & dependencies
- **Report 04:** Database Schema - Prisma models & migrations
- **Report 10:** Testing & Linting - Test infrastructure details

## Quick Reference

### Most Used Commands

```bash
pnpm install          # Install dependencies
pnpm dev             # Start all services
pnpm build           # Build all workspaces
pnpm test            # Run all tests
pnpm lint            # Lint all code
pnpm db:generate     # Generate Prisma client
pnpm db:migrate      # Run migrations
```

### Package Manager Commands

```bash
# Add dependency to specific workspace
pnpm --filter @oasis/api add <package>

# Remove dependency
pnpm --filter @oasis/api remove <package>

# List all workspaces
pnpm list --depth 0

# Run command in all workspaces
pnpm -r <command>
```

### Turborepo Commands

```bash
# Run with specific filter
turbo run build --filter=@oasis/api

# Run with dependencies
turbo run build --filter=@oasis/api...

# Clear Turbo cache
turbo run build --force

# Run in parallel
turbo run dev --parallel
```

---

**Report End** • Generated from package.json analysis at commit 3afe37a
