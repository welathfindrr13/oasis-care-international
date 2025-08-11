# Test Database Setup

## Overview

Our test suite uses production-parity PostgreSQL images to ensure that tests run against the same database environment as production. This eliminates environment-specific issues and ensures that all database extensions, migrations, and queries work identically across test and production environments.

## Requirements

- **Docker**: Required for running test containers
- **pgvector Extension**: Included in our custom PostgreSQL image for AI embeddings support

## Test Database Image

We use a custom PostgreSQL 15 image with pgvector pre-installed:

- **Image**: `ghcr.io/oasis-care/pgvector:15`
- **Base**: `postgres:15-bullseye` (official PostgreSQL image)
- **Extensions**: pgvector for 768-dimensional vector embeddings
- **Timezone**: Europe/London (matches production)
- **Locale**: en_GB.UTF-8

## Running Tests Locally

```bash
# Install dependencies
pnpm install

# Run unit tests (uses Testcontainers)
pnpm turbo run test

# Run E2E tests (uses Testcontainers)
pnpm --filter @oasis/api test:e2e

# Run all tests
pnpm turbo run test && pnpm --filter @oasis/api test:e2e
```

## How It Works

1. **Testcontainers Integration**: Our test helper (`apps/api/test/utils/test-container.ts`) automatically:
   - Pulls `ghcr.io/oasis-care/pgvector:15` image
   - Starts a PostgreSQL container with pgvector enabled
   - Applies all Prisma migrations including vector extension setup
   - Returns a connection string for tests

2. **CI/CD Pipeline**: GitHub Actions uses the same image for service containers, ensuring identical test environments locally and in CI

3. **Migration Support**: All migrations run successfully, including:
   - `CREATE EXTENSION IF NOT EXISTS vector;`
   - Vector table creation with 768-dimensional constraints
   - AI summary tables for embeddings storage

## Production Parity

This setup ensures that:
- ✅ **Same PostgreSQL Version**: 15.x matches production RDS/Aurora
- ✅ **Same Extensions**: pgvector version matches production
- ✅ **Same Timezone**: Europe/London timezone handling
- ✅ **Same Migrations**: All database schema changes work identically
- ✅ **Same Queries**: Vector operations and embeddings work in tests

## Custom Image Maintenance

The `ghcr.io/oasis-care/pgvector:15` image is automatically rebuilt:
- On changes to `ops/docker/pgvector/Dockerfile`
- Weekly via GitHub Actions (security patch updates)
- Manual trigger available in GitHub Actions

## Troubleshooting

### Image Pull Issues
```bash
# Manually pull the image
docker pull ghcr.io/oasis-care/pgvector:15

# Verify pgvector is available
docker run --rm ghcr.io/oasis-care/pgvector:15 \
  psql --version && echo "pgvector available"
```

### Test Failures
If tests fail with `extension "vector" is not available`:
1. Ensure Docker is running
2. Check that the pgvector image is accessible
3. Verify Testcontainers can pull from GHCR

### Local Development
For development without Docker, you can install pgvector locally:
```bash
# macOS with Homebrew
brew install pgvector

# Ubuntu/Debian
sudo apt install postgresql-15-pgvector
```

## Architecture Benefits

- **Environment Consistency**: Eliminates "works on my machine" issues
- **AI Feature Testing**: Full vector embedding support in tests
- **Migration Safety**: Validates production migrations in test environment
- **CI/CD Reliability**: Consistent test results across all environments
