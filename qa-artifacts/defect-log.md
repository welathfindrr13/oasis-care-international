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
- Status: PR #37 deployed to staging / admin proof rerun still fails with visible Unauthorized on queue routes
- Area: Web browser GraphQL client / Clerk bearer propagation
- Environment: staging `c8dab77`

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

Post-PR37 staging deploy passed and VPS HEAD is `c8dab77`. Public smoke passed. Signed-in fake/synthetic admin proof rerun showed `/today` and `/carebridge` render with `ADMIN` and no visible `Unauthorized`, but `/carebridge/approvals`, `/carebridge/concerns`, and `/family-updates/concerns` still render visible `Unauthorized`. No fresh `GraphQL errors: Array(1)` console entries were captured in this proof pass.

Automated sanitized response capture was attempted from the built-in browser, but the tooling cannot expose DevTools Network response bodies, and the read-only page evaluation scope does not expose `fetch`, `XMLHttpRequest`, or the page's Clerk globals. No `/api/graphql` response body was captured. Code inspection shows `clientQuery(...)` can render `Unauthorized` without logging `GraphQL errors:` when `/api/graphql` returns HTTP 401, so HTTP 401 is a plausible but unproven next hypothesis.

Manual DevTools evidence later showed the real failing queue requests had no Authorization header and returned GraphQL `UNAUTHENTICATED`, matching a Clerk readiness race: the queue client requests fire on mount before Clerk session readiness is guaranteed, so no explicit bearer is attached.

Local follow-up fix, not deployed:

- `CareBridgeApprovalsClient` and `CareBridgeConcernsClient` now branch on auth mode before using Clerk React auth.
- Clerk-mode child components use `useAuth()` only when `ClerkProvider` is mounted.
- Protected queue bootstrap waits for Clerk `isLoaded` via a shared `authReady` prop.
- Loaded but signed-out state does not silently fire unauthenticated protected queries.
- Signed-in Clerk requests pass a stable `getBearerToken` callback backed by `getToken()` into `clientQuery(...)`.
- Non-Clerk/local/Cognito mode never calls `useAuth()` and preserves the prior cookie/session `clientQuery(...)` path.
- Mutations on those queue pages also pass the same token callback.
- `/family-updates/concerns` remains transitively covered by the existing alias.

External review blocker addressed locally:

- Hostile review requested changes because the first PR #38 readiness fix called `useAuth()` unconditionally from exported queue clients.
- Regression coverage now verifies the exported approval/concern clients do not call `useAuth()` in the non-Clerk wrapper path.
- Regression coverage now verifies Clerk-only children call `useAuth()`, pass `authReady={isLoaded}`, and provide the stable bearer callback to the shared queue client.

Verification passed locally, including the CareBridge readiness/non-Clerk guard test, client-side GraphQL tests, Clerk/proxy auth tests, web lint, and web builds. Do not claim Issue #11 is fixed until this local fix is committed, reviewed, merged, deployed, and browser proof is clean.

## ISSUE11-DEPLOY-008: Auth env preflight used deploy alias without env visibility

- Severity: Medium
- Status: Diagnosed / owner deploy-lane correction needed
- Area: Deployment V2 staging proof preflight
- Environment: staging deploy gate before PR #38 deploy

### Observation

The controlled staging deploy for PR #38 was stopped before deploy after a sanitized auth provider check returned `NO` for both `AUTH_IDENTITY_PROVIDER` and `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER`.

### Sanitized Diagnosis

- The check ran through the `oasis-staging` alias as SSH user `deploy`.
- `/opt/oasis-care/deploy/v2/.env` exists but is not readable by that SSH user.
- Docker is not readable by that SSH user.
- General passwordless sudo is not available to that SSH user.
- The approved read-only wrapper is available and reports current deployed HEAD `c8dab77`.
- The GitHub Deploy VPS workflow runs `preflight-env.mjs deploy/v2/.env` before compose up and uses `docker compose --env-file deploy/v2/.env`.
- The workflow does not print the env file.
- Compose passes `AUTH_IDENTITY_PROVIDER` into web/API runtime and passes `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER` into web build args and runtime.

### Classification

Root cause category: preflight checked the wrong access context/source. The `NO` result came from an unreadable root-owned env file in the deploy alias context, not from proven non-Clerk staging runtime configuration.

### Required Correction

Use the approved GitHub Deploy VPS workflow or another approved root-equivalent deploy lane for the next deploy attempt. For future proof gates, add/use a sanctioned sanitized auth-env check in the same context as deploy, printing only booleans. Do not source the root-owned `.env` through the plain `oasis-staging` deploy alias.

No deploy, SSH write, env edit, migration, production-data action, secret print, or GitHub variable/secret change was performed during this diagnosis.

## ISSUE11-DEPLOY-009: Deploy workflow lacks sanctioned NEXT_PUBLIC auth-mode equality proof

- Severity: Medium
- Status: Blocking PR #38 staging deploy rerun under current approval criteria
- Area: Deployment V2 staging deploy gate
- Environment: source preflight before GitHub Deploy VPS workflow rerun

### Observation

The approved rerun plan required sanctioned deploy-context proof that both auth provider envs equal `clerk` before triggering the staging deploy.

### Sanitized Source Evidence

- `origin/main` target is `059bde8`.
- PR #38 is merged.
- `.github/workflows/deploy-vps.yml` runs `node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env` before compose up.
- `.github/workflows/deploy-vps.yml` uses `docker compose --env-file deploy/v2/.env`.
- `deploy/v2/docker-compose.yml` passes `AUTH_IDENTITY_PROVIDER` into web/API runtime.
- `deploy/v2/docker-compose.yml` passes `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER` into web build args and runtime.
- `deploy/v2/scripts/preflight-env.mjs` enforces `AUTH_IDENTITY_PROVIDER=clerk` for production-like Deployment V2.
- `deploy/v2/scripts/preflight-env.mjs` requires `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER` to be present.
- `deploy/v2/scripts/preflight-env.mjs` does not enforce `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk`.
- The existing workflow does not print sanitized equality booleans for both provider envs.

### Classification

Root cause category: missing sanctioned equality proof in the approved deploy lane. This is not a live-env failure and does not prove staging is misconfigured. It means the current workflow/source evidence cannot satisfy the explicit proof gate without a small preflight/workflow hardening change or another approved root-equivalent sanitized check.

### Required Correction

Add or approve a sanctioned check that proves, without printing secrets or raw env values, that both Deployment V2 auth provider envs equal `clerk`. Preferred small code fix: update `preflight-env.mjs` to require `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk` for production-like Deployment V2, with tests, then rerun the controlled staging deploy.

No deploy, SSH write, env edit, migration, production-data action, service restart, commit, push, merge, or secret print occurred.

### Local Fix

Timestamp: 2026-06-30 15:41 BST

Status: Fixed locally / not pushed / not deployed.

- `deploy/v2/scripts/preflight-env.mjs` now requires `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk` in production-like Deployment V2 preflight.
- The script prints sanitized auth-mode proof on success using YES/NO only.
- Regression tests cover non-Clerk public auth mode, missing public auth mode, sanitized success proof, and failure output that does not expose secret values.
- `git diff --check`, focused preflight tests, and CI-equivalent Deployment V2 static gates passed.
- Full `pnpm deploy:v2:verify` is locally blocked by dependency build-script approval gating before the verification script can complete.

No deploy, SSH write, env edit, migration, production-data action, service restart, push, merge, or secret print occurred.
