# Defect Log

Last updated: 2026-06-23 18:33:56 BST

## ISSUE11-AUTH-001: Synthetic family Clerk login rejected

- Severity: High
- Status: Open
- Area: Staging auth / Issue #11 browser proof
- Environment: `https://app.oasiscare.care`
- Deployed commit: `3ec66ec`

### Observation

Synthetic admin and staff Clerk logins succeeded, but the supplied synthetic family account was rejected by Clerk with a credential/authentication error.

### Impact

Issue #11 family boundary proof cannot pass until a working fake family Clerk session exists with the correct staging org/role assignment.

### Evidence

- `qa-artifacts/authenticated-browser-proof.md`

### Next Step

Verify the fake family Clerk account exists, password is current, staging org/public metadata/role assignment maps to family access, and backend fake `organization_membership` plus CareBridge family contact/membership/grants match the Clerk subject/email.

## ISSUE11-AUTH-002: GraphQL console errors on authenticated staff/admin surfaces

- Severity: Medium
- Status: Local fix pending review/deploy
- Area: Authenticated browser proof / GraphQL UI requests
- Environment: `https://app.oasiscare.care`
- Deployed commit: `3ec66ec`

### Observation

Admin and staff authenticated routes rendered without visible 500/502 text, but Chrome console captured repeated `GraphQL errors: Array(1)` messages while navigating authenticated surfaces.

### Impact

Authenticated UI proof remains incomplete until the underlying GraphQL error source is identified and either fixed or explicitly accepted as non-blocking.

### Evidence

- `qa-artifacts/authenticated-browser-proof.md`
- Screenshots under `qa-artifacts/screenshots/issue-11-auth-proof/`
- Sanitized read-only VPS log tail showed repeated Prisma `P2003` audit-log writes against `audit_log_organization_id_fkey` during authenticated traffic.

### Next Step

Review/deploy the local audit-log FK fix, then rerun authenticated admin/staff browser proof and confirm console is clean or remaining errors are expected and non-blocking.

## ISSUE11-AUTH-003: Staff `/activity` stats request returns 403

- Severity: Medium
- Status: Open
- Area: Authenticated browser proof / activity stats authorization
- Environment: `https://app.oasiscare.care`
- Deployed commit: `3ec66ec`

### Observation

Synthetic staff could open `/activity` without a visible 500/502, but redacted web logs showed `Failed to fetch today stats: 403`.

### Diagnosis

This is consistent with current code:

- `apps/web/app/api/activity/today/route.ts` returns 403 unless web auth roles include `admin`.
- `apps/api/src/stats/stats.controller.ts` protects `GET /stats/today` with `@Roles('admin')`.

### Impact

Staff `/activity` proof is not clean unless staff is intended to see an authorized empty/forbidden activity state. If staff should see stats, this is a code/config authorization mismatch.

### Evidence

- `qa-artifacts/authenticated-browser-proof.md`
- Read-only sanitized VPS `web` logs.

### Next Step

Decide expected staff behavior for `/activity`. If staff should access it, update web/API role policy and tests. If staff should not access it, treat the 403 as expected and adjust the Issue #11 proof wording to verify a visible safe forbidden state.

## ISSUE11-AUTH-004: Authenticated audit log writes fail organization FK

- Severity: Medium
- Status: Local fix pending review/deploy
- Area: API audit logging / tenant membership parity
- Environment: `https://app.oasiscare.care`
- Deployed commit: `3ec66ec`

### Observation

Redacted VPS API logs showed repeated Prisma `P2003` failures while writing `audit_log` rows tied to `audit_log_organization_id_fkey`.

### Impact

The UI can still render because `AuditLogInterceptor.logToDatabase` catches and logs failures, but authenticated proof is not clean: audit evidence is failing in staging, and console/log noise remains.

### Evidence

- `qa-artifacts/authenticated-browser-proof.md`
- `apps/api/src/common/interceptors/audit-log.interceptor.ts`
- `libs/db/prisma/schema.prisma`

### Next Step

Review the local fix in `apps/api/src/common/interceptors/audit-log.interceptor.ts` and `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts`. If approved, commit/PR/deploy through the controlled lane, then rerun authenticated proof. Longer-term, investigate why staging resolved a non-existent organization id so audit rows can retain internal organization linkage where possible.

### Local Fix

Implemented but not committed/deployed:

- Valid internal organization ids still write normally.
- Audit-log-only `P2003` failures for `audit_log.organization_id` retry once with `organization_id: null`.
- No organizations are auto-created from auth claims.
- No auth/role policy was changed.

Verification:

- `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- --runInBand`: PASS
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/api build`: PASS
- `pnpm build`: PASS
