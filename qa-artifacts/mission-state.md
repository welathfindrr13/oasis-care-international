# Mission State

Last updated: 2026-06-29 16:54 BST

## Active Task

Focused local fix for `/api/graphql` Clerk browser-session token derivation after sanitized signed-in DevTools evidence showed a fake/synthetic admin request with Clerk/session cookies present, no Authorization header, and GraphQL `UNAUTHENTICATED` response on `/carebridge/approvals`.

## Current Branch

- Branch: `carebridge-clerk-graphql-token-fix`
- Deployed staging commit: `97678af`
- Worktree: `/Users/tyreeseedwards/.codex/worktrees/staging-hardening-reconciled/oasis-care`
- Original dirty branch preserved: `feat/staging-live-setup`

## Scope

This run made a local-only source/test fix for the web `/api/graphql` Clerk cookie fallback. No deploy, SSH, service restart, production-data action, destructive database command, migration, staging env edit, commit, push, merge, live payment/email/SMS/fulfilment/order API call, family Clerk setup, staff `/activity` policy change, org-mapping change, or `AWSCLIV2.pkg` cleanup was performed. No browser credentials, cookies, tokens, auth headers, JWTs, session values, or env values were inspected or printed.

## Result

Staging remains deployed at `97678af`. Issue #11 remains failed/blocked until this local fix is committed, reviewed, merged, deployed, and admin CareBridge queue browser proof is rerun.

Local fix result: `apps/web/lib/auth/clerk.ts` now recognizes exact/suffixed `__clerk_db_jwt` cookies and prefers them before exact/suffixed `__session` fallback. The proxy still preserves explicit bearer priority, server Clerk token priority, session-cookie fallback, and non-Clerk/NextAuth behavior. Staff `/activity`, family Clerk account behavior, and external-to-internal org mapping were not changed.

## Pull Request

- PR: #36
- URL: https://github.com/welathfindrr13/oasis-care-international/pull/36
- Base: `main`
- Head: `carebridge-clerk-graphql-token-fix`
- Status: merged / deployed to staging
- Base deployed staging commit: `97678afd8f55b7440c42660b93d53e09a3fdec2e`

## Verification

Issue #11 browser proof status: AUTH PROOF STILL FAILED / BLOCKED. PR #36 deployed successfully, but post-deploy admin proof still has visible `Unauthorized` and GraphQL console errors on `VerifiedVisitStoryApprovalQueue`, `CareRooms`, and `CarebridgeConcernInbox` paths for client-rendered CareBridge queue pages.

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

Local Clerk DB JWT cookie fallback fix:

- RED first: direct TSX tests failed before the source change because the extractor/proxy selected `__session` ahead of `__clerk_db_jwt`.
- `git diff --check`: PASS
- `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (16 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (7 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)
- `./node_modules/.bin/next lint` from `apps/web`: PASS
- `./node_modules/.bin/next build` from `apps/web`: PASS
- `corepack pnpm --filter @oasis/web build`: PASS
- `pnpm lint`, `pnpm --filter @oasis/web build`, and `pnpm build` through the Codex runtime pnpm wrapper: BLOCKED before affected scripts ran by `ERR_PNPM_IGNORED_BUILDS`; generated `pnpm-workspace.yaml` approval stub was removed as tool noise.

## Open Blockers

- Working synthetic family Clerk credentials/session are needed.
- Local Clerk DB JWT cookie fallback fix is not committed, pushed, reviewed, merged, or deployed.
- Admin CareBridge approval/concern surfaces still show `GraphQL errors: Array(1)` plus visible `Unauthorized` on deployed `97678af`; this local fix has not yet been browser-proven on staging.
- ApiRolesGuard order fix is not currently supported by source/test evidence.
- Exact signed-in GraphQL response body capture is blocked by current Chrome/log tooling; only route DOM/console symptoms and a no-cookie unauthenticated control envelope were captured.
- Robust external Clerk org id to internal `organization.id` mapping remains a follow-up blocker; PR #35 only preserves audit events when mapping is stale/missing.
- Staff `/activity` expected behavior needs decision: safe forbidden state vs staff-authorized stats.
- Cookie attributes still need manual DevTools attribute confirmation if exact Secure/SameSite/HttpOnly/domain proof is required.
- Production readiness is not claimed.
- Rollback strategy follow-up remains deferred.

## Next Recommended Action

Next safest action is final diff review and local commit for the Clerk DB JWT cookie fallback fix, then a separate PR/CI/review/merge/deploy lane. After deployment, rerun admin CareBridge queue browser proof. Keep Issue #11 open. Do not proceed to production.

Can continue autonomously: NO - further diagnosis/fix/deploy boundaries require explicit approval.
