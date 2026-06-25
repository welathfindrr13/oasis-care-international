# PR #35 Audit-Log FK Fix Review Packet

## PR

- URL: https://github.com/welathfindrr13/oasis-care-international/pull/35
- Latest commit: dcc869e
- Status: Open draft PR

## Summary

PR #35 improves audit resilience and audit completeness when audit-log writes encounter a stale or external organization foreign key. It is not proven to fix the Issue #11 browser GraphQL console symptom.

The API audit log interceptor still writes audit rows with a valid internal `organization_id` when one is available. If the audit-log insert alone fails with Prisma `P2003` for the audit log organization FK, the interceptor retries that audit write with `organization_id: null`. This preserves the audit event without creating fake organizations, mutating tenant state, weakening auth/role checks, or claiming Issue #11 closure.

## Files Changed

- `apps/api/src/common/interceptors/audit-log.interceptor.ts`
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts`
- `qa-artifacts/authenticated-browser-proof.md`
- `qa-artifacts/defect-log.md`
- `qa-artifacts/mission-state.md`
- `qa-artifacts/test-matrix.md`

## CI Status

GitHub Actions CI passed on PR #35:

- `test`: pass
- `Deployment V2 verification`: pass

## Local Verification Evidence

The clean rebuild branch was verified locally before updating PR #35:

- `git diff --check`
- `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand`
- `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand`
- `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand`
- `pnpm --filter @oasis/api test -- --runInBand`
- `pnpm lint`
- `pnpm --filter @oasis/api build`
- `pnpm build`

Observed full API suite result: 31 test suites passed, 216 tests passed.

## Risk Summary

- Scope is intentionally narrow: audit-log write degradation only.
- This is not a proven client-facing GraphQL/API error fix.
- Auth and role authorization policy are unchanged.
- Staff `/activity` authorization policy is unchanged.
- Family Clerk account/setup remains unchanged.
- No schema migration is required.
- The retry path should only handle audit-log organization FK failures, not general application errors.

## Remaining Blockers

- PR #35 is still draft pending review.
- No deploy has been performed for this fix.
- After merge and separately approved staging deploy, Issue #11 authenticated browser proof must be rerun.
- If browser GraphQL console errors remain after deploy/rerun, continue diagnosis in org mapping, tenant scoping, or route data access.
- Robust external Clerk org id to internal `organization.id` mapping remains a follow-up blocker.
- Synthetic family Clerk account/setup remains a separate blocker.
- Staff `/activity` 403 policy remains a human product/security decision if staff access is desired.

## Reviewer Questions

1. Does the fix catch only audit-log organization FK failures?
2. Does it preserve valid organization audit writes?
3. Does it avoid weakening auth/role checks?
4. Does it avoid hiding unrelated application errors?
5. Is retrying with `organization_id: null` acceptable given the schema?
6. Are tests meaningful enough?
7. Should this PR be approved, changed, or blocked?
