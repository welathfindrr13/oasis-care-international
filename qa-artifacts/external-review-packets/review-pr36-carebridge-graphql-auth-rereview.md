# PR #36 Re-review Packet: Central GraphQL Auth Proxy

## PR

- URL: https://github.com/welathfindrr13/oasis-care-international/pull/36
- Latest commit: pending local commit after `b3bed45`
- Status: Open draft
- Merge state: CLEAN / mergeable
- No deploy performed

## CI Status

Passed on `b3bed45` before this review-change revision:

- `test`
- `Deployment V2 verification`

Local verification for this revision passed before commit.

## Original REQUEST CHANGES Summary

External review found the first PR #36 implementation safe but incomplete:

- It migrated only CareBridge approval/concern pages to `useClerkClientQuery()`.
- Many other authenticated client components still used plain `clientQuery(...)`.
- If browser bearer tokens were required, the fix needed a broader guarded migration.
- If `clientQuery(...)` was meant to authenticate through `/api/graphql`, the correct fix belonged in the shared proxy/auth path instead.

## Chosen Strategy

Strategy A: central `/api/graphql` auth proxy fix.

## Why Central Fix Was Chosen

- `clientQuery(...)` is documented as the shared client-side GraphQL helper that uses `/api/graphql` for authentication.
- `clientQuery(...)` sends `credentials: 'include'`, so same-origin Clerk/session cookies reach the proxy.
- `/api/graphql` already used `getServerAuthContext()` and is the intended auth-forwarding boundary.
- `getServerAuthContext()` calls Clerk `auth().getToken()` in Clerk mode.
- Many protected browser GraphQL surfaces still use `clientQuery(...)`, so migrating only CareBridge would leave a half-migrated convention.
- A broad migration to a Clerk-only hook would risk weakening non-Clerk/NextAuth compatibility and duplicate proxy responsibility.

## Response to External Review REQUEST CHANGES

### 1. Untested Clerk Cookie Extractor

- Reviewer issue: `getClerkBearerTokenFromCookieHeader` was auth-boundary code without enough direct coverage.
- Fix applied: Added direct extractor tests for exact `__session`, suffixed `__session_*` fallback, exact-over-suffixed precedence, deterministic first-suffixed behavior, unrelated/empty values, malformed chunks, URL decoding, and invalid escape handling.
- Files changed:
  - `apps/web/lib/auth/clerk.ts`
  - `apps/web/lib/auth/clerk.test.ts`
- Tests added/updated:
  - `pnpm exec tsx --test apps/web/lib/auth/clerk.test.ts`
- Remaining risk: Function returns an empty string for no token to match existing helper conventions; tests now pin that falsy behavior.

### 2. Token Source Ordering

- Reviewer issue: raw Clerk session cookie was preferred over the server Clerk token.
- Fix applied: Token priority is now explicit bearer first, server-resolved Clerk token second, Clerk cookie fallback third in Clerk mode. Non-Clerk/NextAuth ordering remains unchanged.
- Rationale: explicit bearer is caller intent; server Clerk token is preferred when available because it is resolved for the current request; cookie fallback keeps same-origin browser proxy calls working when server token resolution is unavailable. The API remains the trust anchor because it validates forwarded JWTs.
- Files changed:
  - `apps/web/lib/graphql/proxy-auth.ts`
  - `apps/web/lib/graphql/proxy-auth.test.ts`
- Tests added/updated:
  - explicit bearer priority
  - server Clerk token beats cookie fallback
  - cookie fallback works when server token is unavailable
  - no auth material returns no token
  - non-Clerk token order is unchanged
- Remaining risk: This still forwards bearer material to the API proxy path; no token values are logged and backend validation remains required.

### 3. Dead `useClerkClientQuery` Helper

- Reviewer issue: the prior hook became dead code after the central proxy strategy and could encourage a second client auth convention.
- Fix applied: Removed `apps/web/lib/graphql/useClerkClientQuery.ts`; production code has no remaining references.
- Files changed:
  - `apps/web/lib/graphql/useClerkClientQuery.ts`
  - `apps/web/app/carebridge/carebridge-client-auth.test.js`
- Tests added/updated:
  - CareBridge static tests now assert the shared `clientQuery(...)` proxy path without referencing the deleted hook.
- Remaining risk: None expected; future client GraphQL calls should continue using shared `clientQuery(...)` through `/api/graphql`.

### 4. Route / Proxy Behavior Tests

- Reviewer issue: route behavior needed stronger coverage around anonymous/public handling and token forwarding.
- Fix applied: Resolver tests now cover no-auth behavior and token priority; CareBridge static route tests assert `/api/graphql` uses the central resolver, reads cookie/server auth inputs, keeps the unauthorized path, forwards `Authorization` from `accessToken`, and does not log token/header variables.
- Files changed:
  - `apps/web/lib/graphql/proxy-auth.test.ts`
  - `apps/web/app/carebridge/carebridge-client-auth.test.js`
- Tests added/updated:
  - `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`
  - `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`
- Remaining risk: Full Next route-handler integration tests remain out of scope; unit/static coverage now pins the auth boundary behavior without invoking Clerk live services.

## Files Changed

- `apps/web/app/api/graphql/route.ts`
- `apps/web/lib/auth/clerk.ts`
- `apps/web/lib/auth/clerk.test.ts`
- `apps/web/lib/graphql/proxy-auth.ts`
- `apps/web/lib/graphql/proxy-auth.test.ts`
- `apps/web/lib/graphql/useClerkClientQuery.ts` (removed)
- `apps/web/app/carebridge/approvals/CareBridgeApprovalsClient.tsx`
- `apps/web/app/carebridge/approvals/page.tsx`
- `apps/web/app/carebridge/concerns/CareBridgeConcernsClient.tsx`
- `apps/web/app/carebridge/concerns/page.tsx`
- `apps/web/app/carebridge/carebridge-client-auth.test.js`
- `apps/web/app/family-updates/approvals/page.tsx`
- `apps/web/app/family-updates/concerns/page.tsx`
- `qa-artifacts/authenticated-browser-proof.md`
- `qa-artifacts/defect-log.md`
- `qa-artifacts/external-review-packets/review-pr36-carebridge-clerk-token-rereview.md`
- `qa-artifacts/mission-state.md`
- `qa-artifacts/test-matrix.md`

## Tests Added / Updated

- `apps/web/lib/graphql/proxy-auth.test.ts`
  - explicit bearer extraction
  - explicit bearer priority
  - server Clerk token priority over cookie fallback
  - Clerk session-cookie fallback
  - non-Clerk/NextAuth token order
  - missing auth material
- `apps/web/lib/auth/clerk.test.ts`
  - exact `__session` extraction
  - suffixed `__session_*` fallback
  - exact-over-suffixed precedence
  - multiple suffixed cookie determinism
  - unrelated/empty/malformed cookies
  - URL decoding and invalid escape handling
- `apps/web/app/carebridge/carebridge-client-auth.test.js`
  - CareBridge approval/concern pages use shared `clientQuery(...)`
  - `clientQuery(...)` sends cookies to `/api/graphql`
  - `/api/graphql` uses central token resolution, preserves the unauthorized path, forwards the chosen token, and does not log token/header variables
  - family update aliases remain intact

## Local Verification Evidence

Passed:

- `git diff --check`
- `pnpm exec tsx --test apps/web/lib/auth/clerk.test.ts`
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `pnpm build`

## Remaining Blockers

- Issue #11 still needs controlled staging deploy and authenticated browser proof rerun.
- Fake family Clerk account/setup remains separate.
- Staff `/activity` policy decision remains separate.
- External Clerk org ID to internal `organization.id` mapping remains follow-up.
- Cookie attribute proof remains partial if exact attributes are required.
- No deploy has been performed for PR #36.

## Reviewer Questions

1. Does the central `/api/graphql` auth proxy fix address the root class better than per-page `useClerkClientQuery()` migration?
2. Is the auth resolution order correct and safe?
3. Does it preserve existing `clientQuery(...)` behavior for authenticated pages?
4. Does it avoid weakening auth/role checks?
5. Are explicit bearer, Clerk session-cookie, server Clerk auth, and non-Clerk token paths tested meaningfully?
6. Are CareBridge approval/concern pages now covered without half-migrating conventions?
7. Are there any security risks from token resolution or forwarding?
8. Should this PR be approved, changed, or blocked?
