# PR #37 Review Packet: Browser Clerk Bearer GraphQL Proxy Auth

## PR

- URL: https://github.com/welathfindrr13/oasis-care-international/pull/37
- Latest commit: pending amended push
- Branch: `graphql-proxy-clerk-db-jwt-fix`
- Base: `main`
- Status: Draft PR
- Deployment: no deploy performed

## Browser Split Evidence

Manual sanitized browser console probe from a signed-in fake/synthetic admin session:

- Cookie-only request to `/api/graphql`: HTTP 200, GraphQL `UNAUTHENTICATED`, `data = null`.
- Explicit bearer request to `/api/graphql` using `window.Clerk.session.getToken()`: HTTP 200, no GraphQL errors, object data.

This proves the browser Clerk session exists and the backend accepts the explicit Clerk bearer for `VerifiedVisitStoryApprovalQueue`. It refutes backend resolver, role, and org mapping as the cause for this specific operation. It also means the earlier DB JWT cookie preference premise is not proven and has been removed from the amended fix.

## Summary

The amended PR fixes the shared browser GraphQL path. `clientQuery(...)` now obtains `window.Clerk.session.getToken()` when running in the browser and sends it as `Authorization: Bearer <token>` to same-origin `/api/graphql`.

The web `/api/graphql` proxy already preserves explicit bearer priority and forwards that bearer to the backend. The amended fix uses that proven path instead of relying on unproven Clerk DB JWT cookie selection.

This PR does not change staff `/activity` policy, family Clerk account behavior, backend resolver authorization, or external Clerk org ID to internal `organization.id` mapping.

## Files Changed

- `apps/web/lib/graphql/client-side.ts`
- `apps/web/lib/graphql/client-side.test.ts`
- `apps/web/lib/auth/clerk.ts`
- `apps/web/lib/auth/clerk.test.ts`
- `apps/web/lib/graphql/proxy-auth.test.ts`
- `qa-artifacts/authenticated-browser-proof.md`
- `qa-artifacts/defect-log.md`
- `qa-artifacts/mission-state.md`
- `qa-artifacts/test-matrix.md`

## Local Verification Evidence

- RED first: `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts` failed before the fix because no Authorization header was attached from browser Clerk.
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts`: pass, 4 tests
- `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`: pass, 14 tests
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: pass, 6 tests
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: pass, 6 tests
- `git diff --check`: pass
- `./node_modules/.bin/next lint` from `apps/web`: pass
- `./node_modules/.bin/next build` from `apps/web`: pass
- `corepack pnpm --filter @oasis/web build`: pass

## Risk Summary

- Auth/API risk: Low to medium. The shared browser GraphQL helper now attaches an explicit Clerk bearer when available; backend JWT validation remains the trust boundary.
- Token precedence risk: Low. Caller-provided Authorization remains highest priority. Clerk bearer is only added when no caller Authorization is already present.
- Compatibility risk: Low. If Clerk is absent, has no session, or returns no token, existing cookie-only behavior remains.
- Logging/secrets risk: Low. The implementation does not log, decode, print, store, or expose token, cookie, JWT, Authorization header, or session values.
- Staging risk: Medium until controlled deploy and authenticated browser proof rerun confirm admin CareBridge queues load cleanly.
- Production risk: Do not ship until staging proof is clean.

## Remaining Blockers

- CI must rerun after amended push.
- External review/re-review is required.
- Issue #11 authenticated browser proof must rerun after controlled staging deploy.
- Fake family Clerk account/setup remains separate.
- Staff `/activity` policy decision remains separate.
- Cookie attribute proof remains partial if required.
- External Clerk org ID to internal `organization.id` mapping remains follow-up.
- AWSCLIV2.pkg cleanup remains separate and is not included.

## Reviewer Questions

1. Does the amended shared browser GraphQL client correctly attach `window.Clerk.session.getToken()` as an explicit bearer?
2. Is caller-provided Authorization priority preserved?
3. Does no-Clerk/no-session/no-token behavior safely preserve cookie-only fallback?
4. Does this avoid relying on unproven Clerk DB JWT cookie behavior?
5. Do tests meaningfully cover the browser-auth split regression?
6. Is there any token leakage/logging risk?
7. Is this PR safe to merge before controlled staging deploy and Issue #11 proof rerun?
8. Should this PR be approved, changed, or blocked?
