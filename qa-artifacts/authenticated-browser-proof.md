# Issue #11 Authenticated Browser Proof

Date: 2026-06-23 18:33:56 BST

## Scope

- Domain: `https://app.oasiscare.care`
- Deployed staging commit: `3ec66ec`
- Data policy: fake/synthetic data only
- No deploy performed in this proof run
- No VPS write, restart, migration, env edit, or production-data action performed
- No secrets, cookie values, session tokens, passwords, OTPs, or env values printed

## Local/Deploy Context

- PR #34 is merged.
- Staging deploy report records VPS fast-forward from `f43fa47` to `3ec66ec`.
- Containers were healthy after deploy.
- Public deploy checks already passed for `/`, `/health`, `/ready`, `/sw.js`, and `/api/health`.

## Auth Method Discovery

- Code/docs show staging uses Clerk for production-like auth.
- `docs/deployment-v2/clerk-auth-gate.md` requires Clerk `sub` to map to `OrganizationMembership.auth_subject`, Clerk org context to map to an Oasis organization, and backend membership role/status to be authoritative.
- `apps/web/lib/auth/clerk.ts` maps explicit Clerk family/client metadata or org role to Oasis family-facing `client` presentation state, while default `org:member` is not treated as staff.
- `libs/auth/src/jwt.strategy.ts` requires Clerk tokens to include a valid subject, configured issuer, organization claim, and resolvable role.
- `apps/api/src/auth/api-roles.guard.ts` requires an active `organization_membership` row in Clerk mode before tenant-scoped API access.
- Live probe scripts require explicit `PLAYWRIGHT_*` credentials and `ALLOW_LIVE_RELEASE_PROBES=true`.
- Local environment did not have documented Playwright/Clerk fake user credential variables set.
- Chrome profile was not already signed in for `app.oasiscare.care`.
- User supplied synthetic staging Clerk credentials during the proof run. Passwords were used only in the browser login form and were not recorded in this artifact.

Result: synthetic admin/staff auth proof could proceed; synthetic family auth remained blocked because Clerk rejected the supplied family login.

Still needed, without values:

- Working fake Clerk family test user credentials or an already-authenticated fake family browser session.
- Correct staging Clerk org/role/public metadata plus matching backend `organization_membership` and CareBridge family contact/membership/grants for fake data.

## Signed-Out Browser Proof

Chrome browser proof showed protected routes redirect to the Oasis login page while signed out:

| Route | Result | Screenshot |
| --- | --- | --- |
| `/family` | redirected to `/login?redirect_url=.../family` | `qa-artifacts/screenshots/issue-11-auth-proof/signed-out-_family.png` |
| `/activity` | redirected to `/login?redirect_url=.../activity` | `qa-artifacts/screenshots/issue-11-auth-proof/signed-out-_activity.png` |
| `/today` | redirected to `/login?redirect_url=.../today` | `qa-artifacts/screenshots/issue-11-auth-proof/signed-out-_today.png` |
| `/carebridge` | redirected to `/login?redirect_url=.../carebridge` | `qa-artifacts/screenshots/issue-11-auth-proof/signed-out-_carebridge.png` |
| `/family-updates/concerns` | redirected to `/login?redirect_url=.../family-updates/concerns` | `qa-artifacts/screenshots/issue-11-auth-proof/signed-out-_family_updates_concerns.png` |

No protected data was visible in the signed-out browser proof.

## Public Browser Proof

Chrome browser proof showed public routes still render/respond:

- `/`: public landing page rendered.
- `/health`: returned status JSON in browser.
- `/ready`: returned readiness JSON in browser.
- `/sw.js`: returned service worker JavaScript in browser.

## Console Evidence

- Login page console errors observed through Chrome tooling: 0.
- Admin/staff authenticated surfaces showed repeated browser console messages: `GraphQL errors: Array(1)`.
- Re-read Chrome console after sign-out showed Clerk warnings only on `/login`; prior authenticated admin/staff screenshots remain the browser evidence for the GraphQL console symptom.
- Redacted VPS `api`/`web` logs showed authenticated API/GraphQL traffic returned HTTP 200 for several requests, while the API repeatedly logged Prisma `P2003` audit-log writes against `audit_log_organization_id_fkey`.
- Redacted VPS `web` logs showed `Failed to fetch today stats: 403` for `/api/activity/today`.
- The visible admin/staff routes still rendered without 500/502 text. The authenticated console symptom remains unproven; the audit-log FK failures are a confirmed audit resilience/completeness defect observed alongside it, not proven as the client-facing GraphQL error cause.

## Safe API/CORS Checks

- `https://app.oasiscare.care/api/graphql` safe `__typename` query returned 200 in deploy smoke.
- Unapproved origin CORS check did not allow `https://evil.example` on `/api/health`.
- Unapproved origin CORS preflight did not allow `https://evil.example` on `/api/graphql`.

## Authenticated Proof

Status: PARTIAL / BLOCKED.

### Admin Proof

Synthetic admin login succeeded.

Observed:

- `/today`: rendered without login redirect, 500, or 502; header showed admin role, not `FAMILY ACCESS`.
- `/activity`: rendered without login redirect, 500, or 502.
- `/carebridge`: rendered without login redirect, 500, or 502.
- `/carebridge/approvals`: rendered without login redirect, 500, or 502.
- `/carebridge/concerns`: rendered without login redirect, 500, or 502.
- `/family-updates/concerns`: rendered without login redirect, 500, or 502.
- Sign-out returned to `/login`.

Screenshots:

- `qa-artifacts/screenshots/issue-11-auth-proof/admin-_today.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/admin-_activity.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/admin-_carebridge.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/admin-_carebridge_approvals.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/admin-_carebridge_concerns.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/admin-_family_updates_concerns.png`

### Staff Proof

Synthetic staff login succeeded.

Observed:

- `/today`: rendered without login redirect, 500, or 502; header showed carer/staff role, not `FAMILY ACCESS`.
- `/activity`: rendered without login redirect, 500, or 502, but redacted web logs showed the stats request returned 403. Code confirms `/api/activity/today` and `GET /stats/today` are currently admin-only.
- `/family-updates`: rendered without login redirect, 500, or 502.
- `/carebridge`: rendered without login redirect, 500, or 502.
- Session persisted across reload on `/today`.
- Reload URL did not expose token/session material.
- Sign-out returned to `/login`.

Screenshots:

- `qa-artifacts/screenshots/issue-11-auth-proof/staff-_today.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/staff-_activity.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/staff-_family_updates.png`
- `qa-artifacts/screenshots/issue-11-auth-proof/staff-_carebridge.png`

### Family Proof

Synthetic family login did not succeed. Clerk displayed a credential/authentication error for the supplied synthetic family account.

Diagnosis:

- Rejection happened on the Clerk login surface before the app received a signed-in family session.
- This points to Clerk test-account setup/credentials first, not a family route guard failure.
- After Clerk accepts the fake family user, the account still needs the required staging org/role/public metadata and backend fake CareBridge membership/grants before family boundary proof can pass.

Not proven:

- Fake family authenticated CareBridge view.
- Family-only boundary on staff/internal surfaces.
- Family inability to see raw care logs, raw visits, medication administration rows, evidence exports, approval queue, or staff concerns.
- Family session persistence and sign-out.

### Cookie / Session Sanity

Confirmed without inspecting cookie values/session stores:

- Admin/staff login reached protected routes.
- Staff session persisted across reload.
- Reload URL did not expose token/session material.
- Sign-out returned to `/login`.

Not inspected by Codex due browser safety constraints:

- Cookie values.
- Browser cookie store/session storage/local storage.
- Secure/HttpOnly/SameSite cookie attributes.

Manual browser DevTools confirmation is still needed for cookie attributes if Issue #11 closure requires that exact evidence.

## Read-Only Diagnosis Addendum

Timestamp: 2026-06-23 18:23:48 BST.

Performed:

- Local code/config inspection only.
- Read-only Chrome console inspection.
- Read-only sanitized VPS log tail for `api` and `web`; no env files, tokens, cookies, passwords, or bearer values printed to artifacts.

Findings:

- Family auth failure classification: Clerk-account/setup blocked before app authorization.
- `/activity` classification: staff receives an expected code-level 403 from the current admin-only stats route, but the UI proof language should not call this clean for staff until the intended behavior is decided.
- GraphQL console error classification: unresolved. Authenticated GraphQL/API requests can render data, while global audit logging attempts to insert an `audit_log.organization_id` that fails the organization foreign key. Because audit writes are caught and not expected to propagate into the response path, the audit FK fix should be treated as audit resilience/completeness work, not proof that the browser GraphQL console symptom is resolved.
- Cookie/session attribute classification: Codex cannot inspect browser cookie stores under Chrome safety policy. Behavioral session proof is partial only; exact Secure/SameSite/HttpOnly/domain attribute proof requires owner/manual DevTools confirmation without sharing values.

## Local Fix Addendum

Timestamp: 2026-06-23 18:33:56 BST.

No deploy was performed.

Focused local source fix:

- `apps/api/src/common/interceptors/audit-log.interceptor.ts`
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts`

Root cause:

- The audit interceptor writes `req.user.organizationId` to `audit_log.organization_id`.
- `audit_log.organization_id` is nullable but, when present, references internal `organization.id`.
- If authenticated staging traffic resolves a stale or external organization id, Prisma raises `P2003` on `audit_log_organization_id_fkey`.

Fix behavior:

- Valid internal organization ids still write normally.
- Audit-log-only `P2003` failures for `AuditLog.organization_id` retry once with `organization_id: null`.
- The retry preserves the audit event without inventing or auto-creating organizations from untrusted auth claims.
- Other audit write failures remain caught and logged with a compact sanitized summary.
- Authorization and staff `/activity` role policy were not changed.

Corrected impact claim:

- This PR is not proven to resolve the Issue #11 browser `GraphQL errors: Array(1)` symptom.
- `AuditLogInterceptor.logToDatabase` already catches audit write failures, and the RxJS audit side effect is not expected to change the client response path.
- The local fix improves audit completeness by preserving audit rows when staging presents a stale or external organization id.
- If GraphQL console errors remain after merge/deploy/rerun, the next root cause likely lives in external-to-internal organization mapping, tenant scoping, or route data access rather than audit logging.

Verification:

- RED first: targeted audit interceptor spec failed before the fix because only one write was attempted.
- PASS: `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand`
- PASS: `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand`
- PASS: `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand`
- PASS: `pnpm --filter @oasis/api test -- --runInBand`
- PASS: `git diff --check`
- PASS: `pnpm lint`
- PASS: `pnpm --filter @oasis/api build`
- PASS: `pnpm build`

## PR #36 Local Auth Proxy Addendum

Timestamp: 2026-06-27 10:19 BST.

No deploy was performed.

Focused local source fix:

- `apps/web/app/api/graphql/route.ts`
- `apps/web/lib/auth/clerk.ts`
- `apps/web/lib/auth/clerk.test.ts`
- `apps/web/lib/graphql/proxy-auth.ts`
- `apps/web/lib/graphql/proxy-auth.test.ts`
- `apps/web/lib/graphql/useClerkClientQuery.ts` (removed)
- `apps/web/app/carebridge/carebridge-client-auth.test.js`

Corrected impact claim:

- This PR is expected to fix the CareBridge client GraphQL `Unauthorized` class by keeping authenticated browser GraphQL calls on the central `/api/graphql` proxy path.
- This PR is not Issue #11 closure proof. Issue #11 still needs staging deploy plus authenticated admin/staff/family browser proof rerun.
- Family Clerk account/setup, staff `/activity` policy, cookie attribute proof, and external Clerk org id to internal `organization.id` mapping remain separate blockers/follow-ups.

Fix behavior:

- `clientQuery(...)` remains the shared browser GraphQL path and sends same-origin cookies to `/api/graphql`.
- `/api/graphql` token priority is explicit bearer first, server Clerk token second, Clerk session cookie fallback third in Clerk mode.
- Backend API JWT validation remains the auth trust anchor; token values are not logged.
- The unused `useClerkClientQuery` helper was removed to avoid a second client GraphQL auth convention.

Verification:

- `pnpm exec tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (14 tests)
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/web build`: PASS
- `pnpm build`: PASS

Remaining proof blockers:

- Fix is local only and has not been deployed.
- Robust external Clerk organization id to internal `organization.id` mapping needs follow-up investigation; staging should not leave stale/external org ids reaching audit logging.
- Fake family Clerk account/setup is still blocked.
- Staff `/activity` authorization behavior still needs product/security decision or explicit acceptance.
- Cookie attribute proof still needs manual DevTools confirmation if exact attribute evidence is required.

## Verdict

AUTH PROOF FAILED / BLOCKED.

Signed-out route protection and public route behavior passed. Synthetic admin/staff authenticated route proof partially passed, but authenticated proof cannot pass Issue #11 because the synthetic family login failed, staff `/activity` currently resolves to a stats 403, and authenticated browser console proof still needs rerun after any merged/deployed fixes. The audit-log FK fix is not by itself Issue #11 closure evidence.

Production verdict remains DO NOT SHIP.

## PR #36 Review Change Addendum

Timestamp: 2026-06-26 23:12 BST

No deploy, VPS access, restart, migration, staging env edit, production-data action, real client/caregiver/family data, or live payment/email/SMS/fulfilment/order API call was performed.

External review found the first PR #36 implementation too narrow because only CareBridge approval/concern pages were migrated to a Clerk-aware client helper while many other protected client pages still used plain `clientQuery(...)`.

Architecture inspection:

- `clientQuery(...)` calls same-origin `/api/graphql`.
- `clientQuery(...)` sends `credentials: 'include'`, so browser cookies are available to the proxy.
- `/api/graphql` already attempts server-side auth through `getServerAuthContext()`.
- `getServerAuthContext()` calls Clerk `auth().getToken()` in Clerk mode.
- Middleware includes `/api/graphql` as public but still runs Clerk middleware for matched requests.
- Many protected client components use plain `clientQuery(...)`, so a per-page CareBridge migration would leave a half-migrated convention.

Chosen strategy:

- Strategy A, central shared auth fix.

Corrected local fix:

- `/api/graphql` now resolves auth centrally through `resolveGraphQLProxyAccessToken(...)`.
- Explicit bearer headers still win.
- In Clerk mode, same-origin browser requests can authenticate through the Clerk session cookie token before falling back to server-derived Clerk auth.
- Non-Clerk/NextAuth token order is preserved.
- CareBridge approval/concern components use the shared `clientQuery(...)` path again.
- The route/client split and family aliases remain intact.

Corrected impact claim:

- This is still not Issue #11 closure evidence.
- The fix is local and un-deployed until PR #36 is reviewed, merged, and separately deployed.
- Browser proof must be rerun after deploy before claiming the CareBridge GraphQL symptom is fixed.

Focused verification started:

- PASS: `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`
- PASS: `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`

# 2026-06-25 Admin CareBridge GraphQL Error Diagnosis

Timestamp: 2026-06-25 19:04 BST

## Local CareBridge Token Propagation Fix Addendum

Timestamp: 2026-06-25 19:17 BST

No deploy, VPS access, restart, migration, staging env edit, production-data action, real client/caregiver/family data, or live payment/email/SMS/fulfilment/order API call was performed.

Root cause:

- Admin CareBridge approval/concern pages were client-rendered but called the plain browser `clientQuery(...)` helper.
- Plain `clientQuery(...)` does not attach the active Clerk bearer token.
- The affected GraphQL operations therefore reached the API without the expected authenticated Clerk context and returned GraphQL 200 responses containing authorization errors.

Focused local source fix:

- `/carebridge/approvals` now renders a dynamic server route wrapper around a Clerk-aware client component.
- `/carebridge/concerns` now renders a dynamic server route wrapper around a Clerk-aware client component.
- Both client components call `useClerkClientQuery()` so browser GraphQL requests propagate the Clerk token through the existing helper.
- `/family-updates/approvals` and `/family-updates/concerns` remain aliases of the CareBridge screens and are marked dynamic so build-time prerendering does not execute Clerk client auth hooks outside `ClerkProvider`.
- `useClerkClientQuery()` now returns a stable callback so React hook dependencies remain clean.

Files changed:

- `apps/web/app/carebridge/approvals/page.tsx`
- `apps/web/app/carebridge/approvals/CareBridgeApprovalsClient.tsx`
- `apps/web/app/carebridge/concerns/page.tsx`
- `apps/web/app/carebridge/concerns/CareBridgeConcernsClient.tsx`
- `apps/web/app/family-updates/approvals/page.tsx`
- `apps/web/app/family-updates/concerns/page.tsx`
- `apps/web/app/carebridge/carebridge-client-auth.test.js`
- `apps/web/lib/graphql/useClerkClientQuery.ts`

Verification:

- RED first: focused test failed before the wrapper/client split because the expected Clerk-aware client component files did not exist.
- PASS: `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`
- PASS: `git diff --check`
- PASS: `pnpm lint`
- PASS: `pnpm --filter @oasis/web build`
- PASS: `pnpm build`

Build failure encountered and fixed:

- Initial direct use of `useClerkClientQuery()` inside the client page modules caused Next build prerender failures because Clerk `useAuth` ran outside `ClerkProvider`.
- Moving the client logic behind dynamic route wrappers and marking the family alias routes dynamic fixed the prerender failure.

Remaining proof blockers:

- The fix is local only and has not been committed, reviewed, merged, or deployed.
- Admin/staff CareBridge browser proof must be rerun after a reviewed deploy.
- Fake family Clerk account/setup remains blocked.
- Staff `/activity` expected authorization behavior still needs a product/security decision or explicit acceptance.
- Cookie attributes still need manual DevTools attribute confirmation if exact attribute evidence is required.

Production verdict remains DO NOT SHIP.

## Scope

- Deployed staging commit: `687ee1e`
- Domain: `https://app.oasiscare.care`
- Fake/synthetic admin account only.
- No code changes, deploy, restart, migration, staging env edit, record creation/modification, or production-data action performed.
- No cookies, session storage, local storage, bearer tokens, auth headers, passwords, OTPs, env values, or secrets were inspected or printed.

## Browser Evidence

Fresh synthetic admin Chrome tabs were opened for each failing surface after login.

- `/carebridge/approvals`
  - Header showed `ADMIN`, not `FAMILY ACCESS`.
  - Page rendered without login redirect, 500, or 502.
  - Visible inline error: `Unauthorized`.
  - Console: two fresh `GraphQL errors: Array(1)` events.
  - Operations mapped from code: `VerifiedVisitStoryApprovalQueue` and `CareRooms`.
- `/carebridge/concerns`
  - Header showed `ADMIN`, not `FAMILY ACCESS`.
  - Page rendered without login redirect, 500, or 502.
  - Visible inline error: `Unauthorized`.
  - Console: one fresh `GraphQL errors: Array(1)` event.
  - Operation mapped from code: `CarebridgeConcernInbox`.
- `/family-updates/concerns`
  - Alias of `/carebridge/concerns`.
  - Same visible `Unauthorized` symptom.
- `/carebridge`
  - Rendered cleanly and listed active fake CareBridge rooms.
  - No visible `Unauthorized` state.

The failing pages are client components that call `clientQuery(...)` directly. The repo already has `useClerkClientQuery()`, which wraps `clientQuery(...)` with Clerk `getToken()` for client-side requests, but the CareBridge approval and concern pages do not use it.

## Server Log Evidence

Sanitized read-only VPS logs for the same window showed:

- API requests completed with HTTP 200 and small JSON response bodies during the browser failures.
- No 500/502 route crash was observed for these CareBridge requests.
- Existing audit-log Prisma `P2003` retries still appeared, with PR #35 fallback active.

This separates the remaining admin browser failure from the earlier audit-log FK resilience fix. PR #35 is active, but the visible browser symptom remains.

## Classification

Likely category: client-side authenticated GraphQL token propagation / auth context.

The strongest current root cause is that the client-rendered CareBridge approval and concern pages use the plain GraphQL helper without passing a Clerk bearer token. The browser receives GraphQL `UNAUTHORIZED` errors and renders `Unauthorized`, while server-rendered CareBridge surfaces that use the server GraphQL helper continue to load.

Likely files:

- `apps/web/app/carebridge/approvals/page.tsx`
- `apps/web/app/carebridge/concerns/page.tsx`
- `apps/web/app/family-updates/concerns/page.tsx`
- `apps/web/lib/graphql/client-side.ts`
- `apps/web/lib/graphql/useClerkClientQuery.ts`
- `apps/web/app/api/graphql/route.ts`

Safe next fix plan:

- Convert the CareBridge approval and concern client pages to use `useClerkClientQuery()` for read and mutation calls.
- Add focused regression coverage or code-level checks proving these Clerk-mode client surfaces pass a bearer token path.
- Do not change staff `/activity` policy in this fix.
- Do not claim Issue #11 fixed until the updated code is merged, deployed, and admin/staff/family authenticated browser proof is rerun.

---

# Post-PR35 Deploy Admin/Staff Proof Addendum

Timestamp: 2026-06-25 18:42:44 BST

## Scope

- Deployed staging commit: `687ee1e`
- Domain: `https://app.oasiscare.care`
- Fake/synthetic accounts only.
- Admin/staff proof rerun only.
- Family login was not retried; fake family account setup remains a separate blocker.
- No cookie values, session tokens, passwords, OTPs, or env values were inspected or printed.
- Browser cookie/local/session storage was not inspected.

## Post-Deploy Public / Signed-Out Checks

- `/`: 200
- `/health`: 200
- `/ready`: 200
- `/sw.js`: 200
- `/api/health`: 200
- `/api/graphql` safe `__typename`: 200
- Signed-out `/activity`: 307 redirect to login
- Signed-out `/api/activity/today`: 307 redirect to login

## Admin Proof

Synthetic admin session was already active in Chrome at the start of the browser proof.

Observed:

- Header showed `ADMIN`, not `FAMILY ACCESS`.
- `/today`: rendered without login redirect, 500, or 502.
- `/activity`: rendered without login redirect, 500, or 502.
- `/carebridge`: rendered without login redirect, 500, or 502.
- `/carebridge/approvals`: rendered without login redirect, 500, or 502.
- `/carebridge/concerns`: rendered without login redirect, 500, or 502.
- `/family-updates/concerns`: rendered without login redirect, 500, or 502.
- Admin sign-out reached `/login`.

Console result:

- `GraphQL errors: Array(1)` still appeared on CareBridge approval/concern surfaces.
- Therefore PR #35 did not make authenticated admin browser console proof clean.

## Staff Proof

Synthetic staff login succeeded after admin sign-out.

Observed:

- Header showed `CARER`, not `FAMILY ACCESS`.
- `/today`: rendered without login redirect, 500, or 502.
- `/family-updates`: rendered without login redirect, 500, or 502.
- `/carebridge`: rendered without login redirect, 500, or 502.
- `/activity`: rendered a safe forbidden state: `You do not have access to this activity view. Sign in again to continue.`
- Staff `/today` reload persisted session state and the URL did not expose token/session material.

Console result:

- No `GraphQL errors: Array(1)` were captured in the fresh staff proof tab for `/today`, `/activity`, `/family-updates`, or `/carebridge`.

Session note:

- During final sign-out handling, the tab unexpectedly showed a family-facing header (`FAMILY ACCESS`) instead of the staff header. The visible session was signed out and returned to `/login` without token material in the URL. Treat staff sign-out evidence as partial because of that session-state anomaly.

## Server Log Classification

Recent sanitized post-deploy logs showed:

- API still hits Prisma `P2003` on `audit_log_organization_id_fkey`.
- PR #35 fallback is active: `Audit log organization FK failed; retrying without organization_id`.
- Filtered sampled logs did not show `Failed to write audit log`.
- Web still logs `Failed to fetch today stats: 403`, matching current staff `/activity` authorization policy.

## Verdict

AUTH PROOF STILL FAILED / BLOCKED.

PR #35 improved audit resilience/completeness after deploy, but it did not prove Issue #11 fixed. Admin browser console still showed GraphQL errors on CareBridge approval/concern surfaces. Family proof remains blocked by fake Clerk account setup, staff `/activity` remains a policy decision, and cookie attribute proof remains manual/partial.

Production verdict remains DO NOT SHIP.
