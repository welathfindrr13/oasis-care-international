# PR #35 Audit-Log FK Fix Re-Review Packet

## PR

- URL: https://github.com/welathfindrr13/oasis-care-international/pull/35
- Branch: `audit-log-fk-fix`
- Base: `main`
- Status: Draft PR
- Deployment status: no deploy performed

## Original REQUEST CHANGES Summary

External review found that the first PR #35 packet overstated impact. Audit writes were already caught inside the interceptor and were invoked from an RxJS side effect, so the observed staging `P2003` audit failures were not proven to cause client-facing GraphQL/browser errors. The reviewer also flagged brittle Prisma metadata matching, missing negative/scoping tests, and the need to track the underlying external-to-internal organization mapping defect separately.

## What Changed

- Corrected PR evidence language to describe PR #35 as audit resilience/completeness work.
- Removed claims that PR #35 is proven to fix Issue #11 browser GraphQL console errors.
- Tightened audit FK fallback detection to remain Prisma `P2003` only, reject other models, and require organization FK metadata.
- Added support for Prisma metadata shapes such as `meta.target: ['organization_id']`.
- Added negative/scoping tests for unrelated errors and unsupported Prisma metadata.
- Added follow-up defect tracking for robust external Clerk org id to internal `organization.id` mapping.

## Files Changed

- `apps/api/src/common/interceptors/audit-log.interceptor.ts`
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts`
- `qa-artifacts/authenticated-browser-proof.md`
- `qa-artifacts/defect-log.md`
- `qa-artifacts/mission-state.md`
- `qa-artifacts/test-matrix.md`
- `qa-artifacts/external-review-packets/review-pr35-audit-log-fk-fix-rereview.md`

## Tests Added / Updated

The focused audit interceptor spec now covers:

- Valid internal organization audit writes.
- Stale audit organization FK fallback to `organization_id: null`.
- Prisma target-array metadata for `organization_id`.
- Generic non-`P2003` audit write errors do not retry.
- `P2003` for a different model does not retry.
- `P2003` without organization FK metadata does not retry.
- Existing nullable `organization_id` does not retry.
- Retry failure is caught/logged and does not throw.
- Audit write failure does not change the HTTP response observable.

## Corrected Claim

PR #35 is not proven to resolve Issue #11 or the browser `GraphQL errors: Array(1)` symptom. It preserves audit events and reduces audit-log FK noise when staging presents a stale or external organization id.

After merge and separately approved deploy, Issue #11 authenticated browser proof must be rerun. If GraphQL console errors remain, the next root cause likely lives in external-to-internal organization mapping, tenant scoping, or route data access rather than audit logging.

## Remaining Blockers

- Robust external Clerk organization id to internal `organization.id` mapping remains a follow-up production-readiness blocker.
- Synthetic family Clerk account/setup remains blocked.
- Staff `/activity` 403 policy still needs product/security decision or explicit acceptance.
- Cookie attribute proof still needs manual DevTools confirmation if exact Secure/SameSite/HttpOnly/domain proof is required.
- No deploy has been performed for PR #35.

## Reviewer Questions

1. Does the updated fallback catch only audit-log organization FK failures?
2. Does the updated test suite sufficiently prove unsupported errors do not retry?
3. Is `meta.target: ['organization_id']` support narrow enough for real Prisma `P2003` shapes?
4. Is retrying with `organization_id: null` acceptable as an audit completeness fallback?
5. Is the corrected Issue #11 claim now truthful and sufficiently cautious?
6. Is the external-to-internal organization mapping blocker tracked clearly enough as follow-up?
7. Should this PR be approved, changed, or blocked?
