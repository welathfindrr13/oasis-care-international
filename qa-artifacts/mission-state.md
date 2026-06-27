# Mission State

Last updated: 2026-06-27 10:19 BST

## Active Task

Address PR #36 external review changes for central GraphQL proxy auth boundary hardening.

## Current Branch

- Branch: `carebridge-clerk-graphql-token-fix`
- Deployed staging commit: `687ee1e`
- Worktree: `/Users/tyreeseedwards/.codex/worktrees/staging-hardening-reconciled/oasis-care`
- Original dirty branch preserved: `feat/staging-live-setup`

## Scope

This run addresses the second external review feedback on PR #36 by adding direct Clerk session cookie extractor coverage, making token source priority explicit, removing the dead per-page Clerk query hook, and strengthening static/unit auth boundary tests around the central `/api/graphql` proxy. No deploy, SSH/VPS access, restart, migration, staging env edit, record creation/modification, production data, real client/caregiver/family data, or live payment/email/SMS/fulfilment/order API call was performed.

## Result

Staging remains deployed at `687ee1e`. Public health/smoke checks previously passed. Local PR #36 review changes keep browser GraphQL auth centralized through the shared `/api/graphql` proxy and harden its token boundary. Issue #11 remains failed/blocked until the fix is reviewed, deployed, and authenticated browser proof is rerun.

## Pull Request

- PR: #36
- URL: https://github.com/welathfindrr13/oasis-care-international/pull/36
- Base: `main`
- Head: `carebridge-clerk-graphql-token-fix`
- Status: draft / review changes implemented locally
- Base deployed staging commit: `687ee1e6ba9cfd1e8a42f5c0d3fd2fa8f4b98b60`

## Verification

Issue #11 browser proof status: AUTH PROOF STILL FAILED / BLOCKED. PR #35 improves audit completeness only; post-deploy admin proof still has GraphQL console errors now mapped to `VerifiedVisitStoryApprovalQueue`, `CareRooms`, and `CarebridgeConcernInbox` on client-rendered CareBridge queue pages.

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

## Open Blockers

- Working synthetic family Clerk credentials/session are needed.
- PR #35 is merged and deployed to staging.
- Admin CareBridge approval/concern surfaces showed `GraphQL errors: Array(1)` plus visible `Unauthorized` on deployed `687ee1e`; local central proxy auth fix is not deployed yet.
- Robust external Clerk org id to internal `organization.id` mapping remains a follow-up blocker; PR #35 only preserves audit events when mapping is stale/missing.
- Staff `/activity` expected behavior needs decision: safe forbidden state vs staff-authorized stats.
- Cookie attributes still need manual DevTools attribute confirmation if exact Secure/SameSite/HttpOnly/domain proof is required.
- Production readiness is not claimed.
- Rollback strategy follow-up remains deferred.

## Next Recommended Action

Finish PR #36 auth-boundary review-change verification, commit/push if clean, then wait for CI and external re-review. Keep Issue #11 open. Do not proceed to production.

Can continue autonomously: NO - commit/push/deploy boundaries require explicit approval.
