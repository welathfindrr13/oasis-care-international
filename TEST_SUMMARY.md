# Test Summary Report

## Overview
- **Total Tests:** 80
- **✅ Passed:** 65  
- **❌ Failed:** 15
- **⏭️ Skipped:** 0

## Unit Tests Status
✅ **Unit Tests**: 65 passed, 15 failed  
❌ **E2E Tests**: Configuration issues prevented execution

## Coverage
- **Lines:** 43%
- **Branches:** 30%  
- **Functions:** 18%
- **Statements:** 45%

⚠️ Coverage below thresholds (90% lines, 85% branches/functions)

## Common Issues Identified
- pgvector extension missing in testcontainers
- Database migration failures
- Test container setup issues

## Top Test Failures
### E2E Test Failures
**File:** stats.e2e.spec.ts, visit.e2e.spec.ts, emar.e2e.spec.ts  
**Error:** Command failed: cd ../../libs/db && npx prisma migrate deploy - pgvector extension not available

The E2E tests are trying to use testcontainers with regular PostgreSQL instead of the pgvector image we set up.

## Suggested Fixes
1. **pgvector Extension**: E2E tests use testcontainers which lack pgvector. Consider:
   - Using pgvector/pgvector Docker image in testcontainers setup
   - Skipping vector-dependent migrations in E2E tests  
   - Using dedicated test DB (like we setup on port 5433)

2. **Coverage**: Add more unit tests, especially for:
   - AI summary services (0% coverage)
   - Visit repository (25% coverage)
   - Medication repository (16% coverage)

3. **Test Isolation**: Fix container/port cleanup in E2E tests

## Artifacts Generated
- test-results/junit.xml
- test-results/unit.log
- test-results/e2e.log
- test-results/build.log
- apps/api/coverage/
