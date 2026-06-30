# PR #38 External Review Packet: CareBridge Clerk Readiness

## PR

- URL: https://github.com/welathfindrr13/oasis-care-international/pull/38
- Latest commit: pending review-change amendment after `ced0afb`
- Branch: `carebridge-clerk-readiness-fix`
- Base: `main`
- Status: Draft PR
- CI status: PASS
  - `test`: pass
  - `Deployment V2 verification`: pass
- Deployment: no deploy performed for this PR

## Issue Context

Issue #11 authenticated admin proof on deployed `c8dab77` showed:

- `/today`: rendered as `ADMIN`
- `/carebridge`: rendered as `ADMIN`
- `/carebridge/approvals`: rendered as `ADMIN` but visible `Unauthorized`
- `/carebridge/concerns`: rendered as `ADMIN` but visible `Unauthorized`
- `/family-updates/concerns`: rendered as `ADMIN` but visible `Unauthorized`

Manual DevTools evidence showed the real failing queue requests had no Authorization header and returned GraphQL `UNAUTHENTICATED`. Earlier browser split proof showed cookie-only `/api/graphql` fails while explicit Clerk bearer succeeds.

## Root Cause

The approval and concern queue clients already used shared `clientQuery(...)`, but their protected queries fired on mount before Clerk/session readiness was guaranteed. When that race happened, no explicit bearer was attached, the request fell back to cookie-only behavior, and the backend returned `UNAUTHENTICATED`.

## Fix Summary

- External review requested changes after `ced0afb` because the first fix called Clerk React `useAuth()` from exported queue clients even though `ClerkProvider` is only mounted in Clerk mode.
- Exported approval and concern clients now branch on public auth mode before rendering Clerk-specific children.
- Clerk-mode children use `useAuth()` only when `ClerkProvider` is mounted.
- Protected bootstrap waits for Clerk `isLoaded` through a shared `authReady` prop.
- Loaded but signed-out state does not silently fire unauthenticated protected queries.
- Signed-in protected `clientQuery(...)` calls receive a stable `getBearerToken` callback backed by Clerk `getToken()`.
- Queue mutations on those pages also receive the same token callback.
- Non-Clerk/local/Cognito mode never calls `useAuth()` and preserves the prior cookie/session `clientQuery(...)` path.
- `/family-updates/concerns` remains covered transitively through the CareBridge concerns page alias.

This PR does not change backend guards, resolvers, staff `/activity` policy, family account setup, or external Clerk org ID to internal organization mapping.

## Files Changed

- `apps/web/app/carebridge/approvals/CareBridgeApprovalsClient.tsx`
- `apps/web/app/carebridge/concerns/CareBridgeConcernsClient.tsx`
- `apps/web/app/carebridge/carebridge-client-auth.test.js`
- `qa-artifacts/authenticated-browser-proof.md`
- `qa-artifacts/defect-log.md`
- `qa-artifacts/mission-state.md`
- `qa-artifacts/test-matrix.md`

## Tests Added / Updated

- Updated `apps/web/app/carebridge/carebridge-client-auth.test.js`
  - Verifies approvals client imports `useAuth()`.
  - Verifies concerns client imports `useAuth()`.
  - Verifies only Clerk-mode children call `useAuth()`.
  - Verifies exported non-Clerk wrappers do not call `useAuth()`.
  - Verifies both clients gate protected bootstrap on `authReady` derived from Clerk `isLoaded`.
  - Verifies loaded-but-signed-out handling exists.
  - Verifies protected client queries receive a stable `getBearerToken` callback backed by `getToken()`.
  - Keeps alias coverage for `/family-updates/concerns`.

## Local Verification

- RED first: `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` failed before source changes because the queue clients lacked Clerk readiness gating and explicit token handoff.
- Review-change RED: `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` failed against `ced0afb` because exported queue clients called `useAuth()` unconditionally and lacked non-Clerk wrapper paths.
- `git diff --check`: pass
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts`: pass, 4 tests
- `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`: pass, 14 tests
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: pass, 6 tests
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: pass, 10 tests
- `./node_modules/.bin/next lint` from `apps/web`: pass
- `./node_modules/.bin/next build` from `apps/web`: pass
- `corepack pnpm --filter @oasis/web build`: pass

## Security Constraints

- No tokens, cookies, JWTs, Authorization headers, session values, passwords, env values, or secret material are logged, decoded, stored, printed, or exposed.
- The token remains provided through Clerk `getToken()` at request time.
- Existing `clientQuery(...)` caller Authorization priority remains covered by existing tests.
- Existing no-token fallback remains covered by existing tests.
- Backend authorization remains the trust boundary.

## Remaining Blockers

- External review required before marking ready.
- Controlled staging deploy required after review/merge.
- Issue #11 authenticated browser proof must rerun after deploy.
- Fake family Clerk account/setup remains separate.
- Staff `/activity` policy decision remains separate.
- Cookie attribute proof remains partial if required.
- External Clerk org ID to internal `organization.id` mapping remains follow-up if still relevant.
- AWSCLIV2.pkg cleanup remains separate and is not included.

## Reviewer Questions

1. Do the approval and concern clients now gate protected queries on Clerk `isLoaded` and signed-in state?
2. Do exported approval and concern clients avoid calling `useAuth()` unless Clerk mode is active?
3. Does non-Clerk/local/Cognito mode preserve the previous cookie/session `clientQuery(...)` behavior without crashing?
4. Do protected `clientQuery(...)` calls receive a stable `getBearerToken` callback backed by Clerk `getToken()`?
5. Does the effect re-run once Clerk becomes loaded/signed-in?
6. Does the fix avoid infinite loops or duplicate uncontrolled requests?
7. Is the fix shared enough, with `/family-updates/concerns` covered transitively?
8. Does it preserve caller Authorization priority and no-token fallback through `clientQuery(...)`?
9. Are token values never logged, decoded, stored, or exposed?
10. Do tests meaningfully cover both the readiness race and non-Clerk crash risk?
11. Does this avoid backend guard/resolver/staff/family/org-mapping changes?
12. Is this safe to merge before controlled staging deploy and Issue #11 proof rerun?
