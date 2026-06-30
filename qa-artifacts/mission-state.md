# Mission State

Last updated: 2026-06-30 00:00 BST

## Active Task

Local Clerk readiness race fix for CareBridge queue clients after post-PR37 browser proof still showed visible `Unauthorized`.

## Current Branch

- Branch: `graphql-proxy-clerk-db-jwt-fix`
- Deployed staging commit: `c8dab77`
- Worktree: `/Users/tyreeseedwards/.codex/worktrees/staging-hardening-reconciled/oasis-care`
- Original dirty branch preserved: `feat/staging-live-setup`

## Scope

This run deployed PR #37 merge commit `c8dab77` to staging through the existing GitHub `Deploy VPS` workflow after direct SSH write access was blocked by the `oasis-staging` alias permissions. No production-data action, destructive database command, migration, staging env edit, commit, push, merge, live payment/email/SMS/fulfilment/order API call, family Clerk setup, staff `/activity` policy change, org-mapping change, or `AWSCLIV2.pkg` cleanup was performed. No browser credentials, cookies, tokens, auth headers, JWTs, session values, or env values were inspected or printed.

## Result

Staging is deployed at `c8dab77`. Issue #11 remains failed because the verified local Clerk readiness race fix is not committed, reviewed, merged, or deployed.

Manual DevTools evidence showed the remaining failing queue requests had no Authorization header and returned GraphQL `UNAUTHENTICATED`. Local fix result: the CareBridge approvals and concerns clients now use Clerk React `useAuth()`, wait for `isLoaded`, avoid unauthenticated protected bootstrap when `isSignedIn` is false, and pass `getBearerToken: () => getToken()` into protected `clientQuery(...)` calls. Staff `/activity`, family Clerk account behavior, backend resolver guards, and external-to-internal org mapping were not changed.

## Pull Request

- PR: #37
- URL: https://github.com/welathfindrr13/oasis-care-international/pull/37
- Base: `main`
- Head: `graphql-proxy-clerk-db-jwt-fix`
- Status: merged / deployed to staging
- Base deployed staging commit: `c8dab7707ae5c58c36e8d8e4ef90270cfd4854fc`

## Verification

Issue #11 browser proof status: AUTH PROOF STILL FAILED / BLOCKED. PR #37 deployed successfully, and post-deploy admin shell proof passes for `/today` and `/carebridge`, but queue routes still have visible `Unauthorized`. No fresh `GraphQL errors: Array(1)` console entries were captured in the post-PR37 proof pass.

Evidence logs:

- `qa-artifacts/logs/reconcile/`
- `qa-artifacts/logs/pr34-review-fixes/`
- `qa-artifacts/staging-deploy-report.md`
- `qa-artifacts/authenticated-browser-proof.md`
- `qa-artifacts/screenshots/issue-11-auth-proof/`
- `qa-artifacts/defect-log.md`

Local fix verification:

- `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand`: PASS (9 tests after review changes)
- `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- --runInBand`: PASS
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/api build`: PASS
- `pnpm build`: PASS

CareBridge token propagation local verification:

- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/web build`: PASS
- `pnpm build`: PASS

PR #36 auth-boundary review-change verification:

- `pnpm exec tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (14 tests)
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/web build`: PASS
- `pnpm build`: PASS

PR #36 staging deploy and admin/staff proof:

- VPS fast-forward `687ee1e` -> `97678af`: PASS
- Deployment V2 real env preflight: PASS
- Compose config validation: PASS
- Controlled Compose deploy with `--wait`: PASS
- Post-deploy containers: web/api/caddy/postgres healthy
- Public checks `/`, `/health`, `/ready`, `/sw.js`, `/api/health`: PASS
- Safe `/api/graphql` `__typename`: PASS
- Signed-out `/activity` and `/api/activity/today`: PASS, 307 login redirects
- Admin `/carebridge`: PASS
- Admin `/carebridge/approvals`, `/carebridge/concerns`, `/family-updates/concerns`: FAIL, visible `Unauthorized` and `GraphQL errors: Array(1)`
- PR #36 deployed-content verification: PASS, deployed `97678af` contains central proxy/auth files and removed `useClerkClientQuery.ts`
- Admin queue error capture: PARTIAL / BLOCKED, active admin session reproduced failures but exact signed-in response body could not be intercepted; manual DevTools Network response capture is required
- Staff `/today`, `/family-updates`, `/carebridge`, `/activity`: PASS
- Staff reload/sign-out/session URL behavior: PASS / behavioral only

Local browser Clerk bearer fix:

- RED first: direct TSX tests failed before the source change because `clientQuery(...)` did not attach a Clerk bearer in the browser.
- `git diff --check`: PASS
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts`: PASS (4 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (14 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)

PR #37 staging deploy:

- GitHub Actions `Deploy VPS` workflow run `28394084090`: PASS
- Deploy workflow head SHA: `c8dab7707ae5c58c36e8d8e4ef90270cfd4854fc`
- VPS read-only HEAD after deploy: `c8dab77`
- Containers after deploy: web/api/caddy/postgres healthy
- Public `/health`, `/ready`, `/sw.js`: PASS
- Signed-out `/today`: PASS, 307 login redirect
- Authenticated admin `/today`: PASS, `ADMIN` header, no visible `Unauthorized`, no fresh sanitized GraphQL console errors
- Authenticated admin `/carebridge`: PASS, `ADMIN` header, no visible `Unauthorized`, no fresh sanitized GraphQL console errors
- Authenticated admin `/carebridge/approvals`: FAIL, `ADMIN` header and page shell rendered, but visible `Unauthorized`; no fresh sanitized GraphQL console errors
- Authenticated admin `/carebridge/concerns`: FAIL, `ADMIN` header and page shell rendered, but visible `Unauthorized`; no fresh sanitized GraphQL console errors
- Authenticated admin `/family-updates/concerns`: FAIL, `ADMIN` header and page shell rendered, but visible `Unauthorized`; no fresh sanitized GraphQL console errors
- Sanitized Network response capture: BLOCKED, built-in browser plugin does not expose DevTools Network response bodies; read-only page evaluation exposes neither `fetch` nor `XMLHttpRequest`

Local Clerk readiness race fix:

- RED first: `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` failed because queue clients did not import `useAuth()`, gate on Clerk readiness, or pass `getBearerToken`.
- PR #38 review-change RED: focused tests failed against `ced0afb` because exported queue clients called `useAuth()` unconditionally and had no non-Clerk wrapper path.
- `git diff --check`: PASS
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts`: PASS (4 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (14 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (10 tests)
- `./node_modules/.bin/next lint` from `apps/web`: PASS
- `./node_modules/.bin/next build` from `apps/web`: PASS
- `corepack pnpm --filter @oasis/web build`: PASS

## Open Blockers

- Working synthetic family Clerk credentials/session are needed.
- PR #38 review-change amendment is not committed, pushed, reviewed, merged, or deployed.
- Admin CareBridge approval/concern surfaces still show visible `Unauthorized` on deployed `c8dab77` until the local fix is deployed and proven.
- ApiRolesGuard order fix is not currently supported by source/test evidence.
- Exact post-PR37 signed-in GraphQL response body capture is blocked by current built-in browser tooling; only route DOM/console symptoms were captured after PR #37.
- Robust external Clerk org id to internal `organization.id` mapping remains a follow-up blocker; PR #35 only preserves audit events when mapping is stale/missing.
- Staff `/activity` expected behavior needs decision: safe forbidden state vs staff-authorized stats.
- Cookie attributes still need manual DevTools attribute confirmation if exact Secure/SameSite/HttpOnly/domain proof is required.
- Production readiness is not claimed.
- Rollback strategy follow-up remains deferred.

## Next Recommended Action

Next safest action is commit and push the PR #38 non-Clerk safety amendment after verification, then rerun PR #38 CI/re-review. Keep Issue #11 open. Do not proceed to production.

Can continue autonomously: NO - further diagnosis/fix/deploy boundaries require explicit approval.
