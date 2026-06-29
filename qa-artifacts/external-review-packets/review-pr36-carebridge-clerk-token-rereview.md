# PR #36 Re-review Packet: CareBridge GraphQL Auth Path

## PR

- URL: https://github.com/welathfindrr13/oasis-care-international/pull/36
- Latest local commit: pending commit after review changes
- Status: Draft
- No deploy performed

## Original REQUEST CHANGES Summary

External review found the first PR #36 approach safe but incomplete:

- CareBridge approval/concern pages were migrated to `useClerkClientQuery()`.
- Many other authenticated client components still used plain `clientQuery(...)`.
- If browser bearer tokens were required, the PR needed a guarded migration for all protected client GraphQL usage.
- If `clientQuery(...)` was intended to authenticate centrally through `/api/graphql`, the stated root cause and fix layer were wrong.

## Chosen Strategy

Strategy A: central shared auth fix.

Evidence for choosing this:

- `apps/web/lib/graphql/client-side.ts` documents `clientQuery(...)` as the client-side GraphQL helper that uses `/api/graphql` to handle authentication.
- `clientQuery(...)` already sends `credentials: 'include'`, so same-origin Clerk/session cookies are available to the proxy.
- `apps/web/app/api/graphql/route.ts` already attempts server-side auth through `getServerAuthContext()`.
- `apps/web/lib/auth/server-auth.ts` calls Clerk `auth().getToken()` in Clerk mode.
- `apps/web/middleware.ts` includes `/api/graphql` as a public route but still runs Clerk middleware for matched requests.
- Many protected client components still use plain `clientQuery(...)`; migrating only CareBridge would leave a half-migrated convention and could weaken non-Clerk compatibility.

The central fix makes `/api/graphql` resolve auth consistently from explicit bearer headers, Clerk session cookies, server-side Clerk auth, and NextAuth token material depending on auth mode.

## What Changed

- Added `apps/web/lib/graphql/proxy-auth.ts` with pure token-resolution helpers.
- Updated `/api/graphql` route to use the central resolver.
- In Clerk mode, the proxy now uses the Clerk session cookie token from same-origin browser requests before falling back to server-derived Clerk auth.
- Explicit bearer headers still take priority.
- NextAuth/Cognito behavior remains outside Clerk mode and preserves server/session token order.
- CareBridge approval/concern components now use the shared `clientQuery(...)` path instead of a special per-page Clerk hook.
- Existing route/client component split and family aliases are preserved.
- Reverted the `useClerkClientQuery()` stability tweak because the selected strategy does not use a guarded Clerk hook migration.

## Tests Added / Updated

- `apps/web/lib/graphql/proxy-auth.test.ts`
  - direct bearer extraction
  - explicit bearer priority
  - Clerk cookie token path
  - Clerk server-auth fallback
  - NextAuth token order outside Clerk mode
  - missing auth returns no token
- `apps/web/app/carebridge/carebridge-client-auth.test.js`
  - CareBridge approval/concern client components use the shared authenticated GraphQL proxy
  - `clientQuery(...)` sends cookies to `/api/graphql`
  - `/api/graphql` uses central token resolution with request cookies and server auth
  - family update aliases remain intact

## Local Verification

Passed:

- `git diff --check`
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `pnpm build`

## Risk Summary

- Auth/API risk: Medium. The shared proxy auth path changes for all browser client GraphQL calls in Clerk mode.
- Clerk risk: Medium. The proxy now uses same-origin Clerk session-cookie token material for browser requests; backend JWT validation still verifies the token.
- NextAuth/Cognito risk: Low. Non-Clerk mode token order is preserved by tests.
- UI risk: Low. CareBridge UI behavior is otherwise unchanged.
- Regression risk: Medium until PR CI and post-deploy authenticated browser proof pass.

## Remaining Blockers

- Issue #11 still requires controlled deploy and authenticated browser proof rerun.
- Fake family Clerk account/setup remains separate.
- Staff `/activity` policy decision remains separate.
- External Clerk org ID to internal `organization.id` mapping remains follow-up.
- Cookie attribute proof remains partial if exact attributes are required.
- No deploy has been performed for PR #36.

## Reviewer Questions

1. Is central `/api/graphql` token resolution the correct layer for browser GraphQL auth?
2. Is using same-origin Clerk session-cookie token material before server-derived Clerk auth acceptable?
3. Does explicit bearer priority remain correct?
4. Does non-Clerk/NextAuth behavior remain intact?
5. Are the CareBridge pages now avoiding a half-migrated Clerk-only convention?
6. Are the tests meaningful enough for the proxy auth path?
7. Should PR #36 be approved, changed, or blocked?
