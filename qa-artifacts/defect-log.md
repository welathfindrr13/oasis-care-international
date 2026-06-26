# Defect Log

Last updated: 2026-06-26 23:12 BST

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
- Status: Local fix implemented; not deployed
- Area: Authenticated browser proof / GraphQL UI requests
- Environment: `https://app.oasiscare.care`
- Deployed commit: `687ee1e`

### Observation

Admin and staff authenticated routes rendered without visible 500/502 text, but Chrome console captured repeated `GraphQL errors: Array(1)` messages while navigating authenticated surfaces.

### Impact

Authenticated UI proof remains incomplete until the underlying GraphQL error source is identified and either fixed or explicitly accepted as non-blocking.

### Evidence

- `qa-artifacts/authenticated-browser-proof.md`
- Screenshots under `qa-artifacts/screenshots/issue-11-auth-proof/`
- Sanitized read-only VPS log tail showed repeated Prisma `P2003` audit-log writes against `audit_log_organization_id_fkey` during authenticated traffic. Those audit failures are confirmed, but they are not proven to be the browser GraphQL console error cause because audit writes are caught and should not affect the client response path.
- Post-PR35 deploy rerun on `687ee1e` still showed `GraphQL errors: Array(1)` on admin CareBridge approval/concern surfaces.
- 2026-06-25 focused admin diagnosis:
  - `/carebridge/approvals` rendered as admin but showed inline `Unauthorized` and two fresh `GraphQL errors: Array(1)` console events.
  - `/carebridge/concerns` rendered as admin but showed inline `Unauthorized` and one fresh `GraphQL errors: Array(1)` console event.
  - `/family-updates/concerns` aliases the same concern page and showed the same visible symptom.
  - `/carebridge` rendered cleanly and listed fake active CareBridge rooms.
  - API logs for the same window showed HTTP 200 GraphQL responses with small JSON bodies, not 500/502 crashes.
  - Code maps the failing operations to `VerifiedVisitStoryApprovalQueue`, `CareRooms`, and `CarebridgeConcernInbox`.
  - The failing pages call the plain `clientQuery(...)` helper directly, while the repo already has `useClerkClientQuery()` for adding Clerk bearer tokens to client-side GraphQL calls.

### Diagnosis

Likely client-side GraphQL proxy auth context issue, not an unresolved audit-log FK crash and not a CareBridge resolver/database 500. Review showed the correct fix layer is the shared `/api/graphql` proxy because `clientQuery(...)` is the intended authenticated browser GraphQL abstraction and many protected client components use it.

### Next Step

Review, commit, merge, deploy, and rerun admin/staff browser proof for the CareBridge approval/concern pages. PR #35 and un-deployed PR #36 changes should not be treated as Issue #11 closure evidence.

### Local Fix

First PR #36 local fix was revised after external review. Current local strategy is central proxy auth, not per-page Clerk hook migration.

- `/api/graphql` now resolves auth centrally through explicit bearer, Clerk session cookie, server Clerk auth, or NextAuth token material depending on mode.
- CareBridge approval/concern components use the shared `clientQuery(...)` path.
- `/family-updates/approvals` and `/family-updates/concerns` remain aliases.

Verification:

- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/web build`: PASS
- `pnpm build`: PASS

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
- Status: PR #35 deployed to staging; fallback active
- Area: API audit logging / tenant membership parity
- Environment: `https://app.oasiscare.care`
- Deployed commit: `687ee1e`

### Observation

Redacted VPS API logs showed repeated Prisma `P2003` failures while writing `audit_log` rows tied to `audit_log_organization_id_fkey`.

### Impact

The UI can still render because `AuditLogInterceptor.logToDatabase` catches and logs failures, but audit completeness is degraded: audit rows tied to stale/external organization ids are missing unless the write falls back to nullable `organization_id`.

### Evidence

- `qa-artifacts/authenticated-browser-proof.md`
- `apps/api/src/common/interceptors/audit-log.interceptor.ts`
- `libs/db/prisma/schema.prisma`

### Next Step

PR #35 is merged and deployed. The fallback is active in logs, but this PR does not prove the browser GraphQL console symptom is fixed; it preserves audit events while the organization mapping defect is investigated separately.

### Local Fix

Implemented in PR #35 and deployed to staging:

- Valid internal organization ids still write normally.
- Audit-log-only `P2003` failures for `audit_log.organization_id` retry once with `organization_id: null` when Prisma metadata identifies the audit-log organization FK.
- Negative/scoping tests cover generic errors, wrong models, irrelevant FK metadata, nullable org id input, retry failure handling, and response-path isolation.
- No organizations are auto-created from auth claims.
- No auth/role policy was changed.

Post-deploy evidence:

- API logs still show Prisma `P2003` on `audit_log_organization_id_fkey`.
- API logs now show `Audit log organization FK failed; retrying without organization_id`.
- Filtered sampled logs did not show `Failed to write audit log`.

Verification:

- `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- --runInBand`: PASS
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/api build`: PASS
- `pnpm build`: PASS

## ISSUE11-AUTH-005: External Clerk org id can reach internal organization FK surfaces

- Severity: High
- Status: Open / follow-up blocker
- Area: Tenant organization mapping / production readiness
- Environment: `https://app.oasiscare.care`
- Deployed commit: `687ee1e`

### Observation

Sanitized staging logs showed `audit_log.organization_id` FK failures during authenticated Clerk traffic. `apps/api/src/auth/api-roles.guard.ts` has an `enrichOrganizationContext` path that can map Clerk external organization ids through `organization_membership.external_organization_id`, but staging still allowed a stale or external value to reach the audit log write path.

### Impact

Audit fallback with `organization_id: null` preserves the audit event, but it does not fix the underlying tenant mapping/parity problem. Production readiness needs robust external Clerk organization id to internal `organization.id` resolution so tenant-scoped records retain internal organization linkage.

### Evidence

- `qa-artifacts/authenticated-browser-proof.md`
- `apps/api/src/auth/api-roles.guard.ts`
- `libs/db/prisma/schema.prisma`

### Next Step

Investigate staging membership/identity-map parity and route-specific auth contexts. Confirm every Clerk authenticated request gets an internal `organization.id` before code writes tenant-scoped records. Do not broaden PR #35 into this full mapping fix without separate approval.
