# Defect Log

Last updated: 2026-06-29 16:54 BST

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
- Status: Open after PR #36 deploy
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
- Post-PR36 deploy rerun on `97678af` still showed visible `Unauthorized` and fresh `GraphQL errors: Array(1)` on admin `/carebridge/approvals`, `/carebridge/concerns`, and `/family-updates/concerns`.
- 2026-06-25 focused admin diagnosis:
  - `/carebridge/approvals` rendered as admin but showed inline `Unauthorized` and two fresh `GraphQL errors: Array(1)` console events.
  - `/carebridge/concerns` rendered as admin but showed inline `Unauthorized` and one fresh `GraphQL errors: Array(1)` console event.
  - `/family-updates/concerns` aliases the same concern page and showed the same visible symptom.
  - `/carebridge` rendered cleanly and listed fake active CareBridge rooms.
  - API logs for the same window showed HTTP 200 GraphQL responses with small JSON bodies, not 500/502 crashes.
  - Code maps the failing operations to `VerifiedVisitStoryApprovalQueue`, `CareRooms`, and `CarebridgeConcernInbox`.
  - The failing pages call the plain `clientQuery(...)` helper directly, while the repo already has `useClerkClientQuery()` for adding Clerk bearer tokens to client-side GraphQL calls.

### Diagnosis

Likely client-side GraphQL proxy auth context issue, not an unresolved audit-log FK crash and not a CareBridge resolver/database 500. Review showed the correct fix layer is the shared `/api/graphql` proxy because `clientQuery(...)` is the intended authenticated browser GraphQL abstraction and many protected client components use it. A follow-up review accepted the central proxy architecture but required auth-boundary hardening before approval.

### Next Step

Diagnose the remaining admin CareBridge queue GraphQL authorization failure after PR #36 deploy. Treat the central proxy token propagation fix as deployed but insufficient for Issue #11 closure. Do not broaden into staff `/activity`, family Clerk setup, or org-mapping changes without separate approval.

### PR #36 Fix

First PR #36 local fix was revised after external review. Final strategy is central proxy auth, not per-page Clerk hook migration.

- `/api/graphql` now resolves auth centrally through explicit bearer, Clerk session cookie, server Clerk auth, or NextAuth token material depending on mode.
- Token priority is explicit bearer first, server Clerk token second, Clerk session cookie fallback third in Clerk mode; backend JWT validation remains the trust anchor.
- `getClerkBearerTokenFromCookieHeader` now has direct coverage for exact and suffixed Clerk session cookies, deterministic precedence, malformed chunks, URL decoding, unrelated cookies, and empty values.
- The unused `useClerkClientQuery` hook was removed so future client GraphQL work stays on the shared proxy path.
- CareBridge approval/concern components use the shared `clientQuery(...)` path.
- `/family-updates/approvals` and `/family-updates/concerns` remain aliases.

Verification:

- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS
- `pnpm exec tsx --test apps/web/lib/auth/clerk.test.ts`: PASS
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/web build`: PASS
- `pnpm build`: PASS

Post-deploy result:

- PR #36 is merged and deployed to staging commit `97678af`.
- Public health/smoke checks passed.
- Staff proof passed for `/today`, `/family-updates`, `/carebridge`, and `/activity`.
- Admin `/carebridge` passed.
- Admin `/carebridge/approvals`, `/carebridge/concerns`, and `/family-updates/concerns` still failed with visible `Unauthorized` plus `GraphQL errors: Array(1)`.

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

## ISSUE11-AUTH-006: Admin CareBridge queue authorization checks run before tenant role enrichment

- Severity: High
- Status: Guard-order hypothesis not reproduced in current source; open root cause
- Area: Authenticated browser proof / GraphQL role guard ordering
- Environment: `https://app.oasiscare.care`
- Deployed commit: `97678af`

### Observation

After PR #36 deployed, synthetic admin could access `/carebridge` and saw the `ADMIN` header with fake CareBridge room data, but the admin queue pages still showed visible `Unauthorized` plus `GraphQL errors: Array(1)`:

- `/carebridge/approvals`
- `/carebridge/concerns`
- `/family-updates/concerns`

### Diagnosis

The primary root cause is guard ordering. `ApiRolesGuard.canActivate()` calls `super.canActivate(context)` before `enrichOrganizationContext(request.user)`. The inherited `RolesGuard.handleRequest()` asserts resolver roles during that first pass.

For Clerk tenant traffic, the trusted internal role is applied later from `OrganizationMembership`. A raw Clerk token role that is still `user` can pass `careRooms` because that resolver allows `admin`, `carer`, and `user`, but it fails queue resolvers that require `admin` or `carer` before membership enrichment can promote the user to the internal tenant role.

2026-06-29 follow-up:

- Current `origin/main` at `97678af` already overrides `ApiRolesGuard.handleRequest()` to authenticate only.
- `ApiRolesGuard.canActivate()` then enriches membership and runs `assertRequiredRoles()` after enrichment.
- Existing `api-roles.guard.spec.ts` covers raw Clerk `org:member` becoming verified membership `admin` or `carer` for restrictive handler roles.
- Direct Jest verification passed for the auth guard and JWT strategy suites.
- Therefore the guard-order hypothesis is not a safe source-code fix target without new evidence; the remaining admin queue `Unauthorized` needs the actual sanitized GraphQL error body / resolver error source captured next.

### Impact

Admin/staff queue authorization is inconsistent with the header and tenant membership model. This blocks Issue #11 authenticated browser proof and staging release readiness.

### Evidence

- `apps/api/src/auth/api-roles.guard.ts`
- `libs/auth/src/roles.guard.ts`
- `apps/api/src/carebridge/carebridge.resolver.ts`
- `apps/api/src/carebridge/carebridge.service.ts`
- `apps/api/src/auth/api-roles.guard.spec.ts`
- `qa-artifacts/authenticated-browser-proof.md`

### Next Step

Do not create a no-op guard-order PR. Capture sanitized admin queue GraphQL error details next: operation name, HTTP status, GraphQL `message`, `extensions.code`, and `path`, without cookies/tokens/auth headers. Then choose the next focused fix from that evidence. Do not change staff `/activity` policy, family Clerk setup, or org-mapping behavior without separate approval.

### 2026-06-29 Capture Attempt

Exact GraphQL error-body capture was attempted in Chrome, but Chrome had no active Oasis admin session. `/carebridge/approvals` redirected to `/login`, so no authenticated queue GraphQL request occurred and no response body was available. The next capture requires the user to sign in as the fake/synthetic admin directly in Chrome first.

### 2026-06-29 Admin Session Capture

The fake/synthetic admin Chrome session was active and `/today` showed admin context with visible `ADMIN`.

Captured route symptoms:

- `/carebridge/approvals`: visible `Unauthorized`; approval queue shell rendered; two fresh `GraphQL errors: Array(1)` console entries. Operation mapping is `VerifiedVisitStoryApprovalQueue` plus `CareRooms`; `clientQuery(...)` sends separate `/api/graphql` requests through `Promise.all`, not one batched operation.
- `/carebridge/concerns`: visible `Unauthorized`; concern inbox shell rendered; one fresh `GraphQL errors: Array(1)` console entry. Operation mapping is `CarebridgeConcernInbox`.
- `/family-updates/concerns`: visible `Unauthorized`; same concern inbox alias shell rendered; one fresh `GraphQL errors: Array(1)` console entry. Operation mapping is `CarebridgeConcernInbox`.

Exact signed-in response-body capture was not possible with the available Chrome tooling:

- Chrome extension logs expose console messages but not network response bodies.
- Read-only page evaluation did not expose `fetch` or constructible `XMLHttpRequest`.
- Local Chrome did not expose a DevTools debugging socket on `127.0.0.1:9222`.

A no-cookie unauthenticated control request to `/api/graphql` for `CareRooms`, `VerifiedVisitStoryApprovalQueue`, and `CarebridgeConcernInbox` returned the matching GraphQL envelope:

- HTTP status: `200`
- JSON keys: `errors`, `data`
- `error.message`: `Unauthorized`
- `error.extensions.code`: `UNAUTHENTICATED`
- `error.path`: `null`
- `data`: `null`
- batched: `false`
- variable keys: none

Server log limitation:

- Approved read-only VPS wrapper confirmed deployed commit `97678af` and healthy containers.
- Direct compose logs as `deploy` were blocked by `.env` permissions.
- `sudo -n docker logs` was denied because sudo requires a password.
- No permissions were changed and no root/log workaround was attempted.

Updated diagnosis:

- The signed-in admin browser still behaves like the affected `/api/graphql` calls have no usable auth.
- Staging is on `97678af`, while local branch `carebridge-clerk-graphql-token-fix` has later central proxy/auth hardening at `8542ee9`.
- Treat this as an auth proxy/deploy-parity blocker first. Do not claim Issue #11 is fixed.

Correction after PR #36 merge verification:

- PR #36 was squash-merged as `97678afd8f55b7440c42660b93d53e09a3fdec2e`; `8542ee9` was the branch commit before squash.
- Read-only VPS inspection confirmed deployed HEAD is `97678af`.
- Deployed `97678af` includes the PR #36 central GraphQL proxy/auth files:
  - `apps/web/app/api/graphql/route.ts`
  - `apps/web/lib/graphql/proxy-auth.ts`
  - `apps/web/lib/auth/clerk.ts`
  - `apps/web/lib/graphql/proxy-auth.test.ts`
  - `apps/web/lib/auth/clerk.test.ts`
- Deployed code does not include `apps/web/lib/graphql/useClerkClientQuery.ts`, matching the final PR #36 architecture.
- Therefore category A, missing PR #36 deploy, is ruled out.

Corrected signed-in capture status:

- In-app browser was signed out, so it could not provide signed-in admin response evidence.
- Existing Chrome tab was signed in as fake/synthetic admin and showed `ADMIN`.
- Routes still showed visible `Unauthorized` and fresh `GraphQL errors: Array(1)`:
  - `/carebridge/approvals`: two console GraphQL error entries; mapped operations `VerifiedVisitStoryApprovalQueue` plus `CareRooms`; separate requests, not batched.
  - `/carebridge/concerns`: one console GraphQL error entry; mapped operation `CarebridgeConcernInbox`.
  - `/family-updates/concerns`: one console GraphQL error entry; mapped operation `CarebridgeConcernInbox` through alias.
- Signed-in response body was not captured because available browser tooling exposes DOM/console logs, not network bodies, and read-only page evaluation has no `fetch`/`XMLHttpRequest`.
- The no-cookie control response must not be used as the signed-in admin error body.

Current root-cause classification:

- H. Unknown / insufficient evidence until real signed-in `/api/graphql` response JSON is captured.
- B/C/D/E remain possible: proxy still failing to provide usable auth, backend rejecting forwarded token, resolver/guard denial, or org/tenant mapping issue.

Required next step:

- Manual DevTools Network capture from the signed-in admin tab, copying only sanitized Response JSON `errors` fields and `data` null/partial state for failed `/api/graphql` requests.

## ISSUE11-AUTH-007: Browser GraphQL client does not attach explicit Clerk bearer

- Severity: High
- Status: Local fix amended on PR #37 / not deployed
- Area: Web browser GraphQL client / Clerk bearer propagation
- Environment: PR #37 branch `graphql-proxy-clerk-db-jwt-fix`; staging still at deployed `97678af`

### Observation

Manual sanitized DevTools evidence from a signed-in fake/synthetic admin request showed:

- Route: `/carebridge/approvals`
- Operation: `VerifiedVisitStoryApprovalQueue`
- Request URL path: `/api/graphql`
- HTTP status: `200 OK`
- Browser request had Clerk/session cookies present, values redacted.
- Browser request had no Authorization header.
- Response JSON: `errors[0].message = Unauthorized`, `errors[0].extensions.code = UNAUTHENTICATED`, `data = null`.

Follow-up browser split probe showed:

- Cookie-only `/api/graphql` request: HTTP 200 GraphQL `UNAUTHENTICATED`, `data = null`.
- Explicit bearer `/api/graphql` request using `window.Clerk.session.getToken()`: HTTP 200, no GraphQL errors, object data.

### Diagnosis

The backend accepts the explicit Clerk bearer for `VerifiedVisitStoryApprovalQueue`, so backend resolver, role, and org mapping are not the cause for this operation. The cookie-only browser path fails because the shared browser GraphQL helper does not attach the active Clerk session token as an explicit bearer. The earlier DB JWT cookie preference hypothesis is unproven and was removed.

### Local Fix

- `apps/web/lib/graphql/client-side.ts` now loads browser Clerk when available, calls `window.Clerk.session.getToken()`, and sends `Authorization: Bearer <token>` to same-origin `/api/graphql`.
- Caller-provided Authorization remains highest priority.
- Existing no-Clerk/no-token cookie-only behavior remains as fallback.
- Server-side behavior and the `/api/graphql` proxy explicit bearer path are unchanged.
- No auth/role checks, staff `/activity` policy, family account behavior, or org mapping logic were changed.
- No token, cookie, JWT, password, auth header, or secret values were logged or stored.

### Verification

- RED first: client-side GraphQL tests failed before the fix because no Authorization header was sent from `clientQuery(...)`.
- PASS: `git diff --check`
- PASS: `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`
- PASS: `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts`
- PASS: `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`
- PASS: `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`
- PASS: `./node_modules/.bin/next lint` from `apps/web`
- PASS: `./node_modules/.bin/next build` from `apps/web`
- PASS: `corepack pnpm --filter @oasis/web build`
- BLOCKED before running scripts: root `pnpm lint` / `pnpm build` via the Codex runtime pnpm wrapper hit dependency approval gating.

### Next Step

PR #37 needs CI and external re-review after the amended commit. After merge and controlled staging deploy, rerun admin CareBridge queue browser proof. Do not claim Issue #11 is fixed until browser proof is clean.
