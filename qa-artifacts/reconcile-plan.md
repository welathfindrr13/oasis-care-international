# Reconciliation Plan

Last updated: 2026-06-22 20:26:49 BST

## Summary

Clean reconciliation branch created: YES.

- Source branch: `feat/staging-live-setup`
- Source commit: `eb068d6`
- Target base: `origin/main` at `f43fa47`
- Clean branch: `release/staging-hardening-reconciled`
- Worktree path: `/Users/tyreeseedwards/.codex/worktrees/staging-hardening-reconciled/oasis-care`
- Deploy/VPS access: none
- Commit/push: none

The Deployment V2 hardening conflicts were manually reconciled onto current Clerk-based `origin/main` behavior. The old Cognito-shaped hardening was not restored; current Clerk behavior was preserved while production placeholder/default fallbacks were removed.

## Files Reconciled

- `deploy/v2/docker-compose.yml`
  - Preserved current Clerk Deployment V2 variables.
  - Changed production/staging env interpolation from unsafe placeholder/default values to required `:?` interpolation for public URLs, auth, Clerk, Postgres, Caddy, and API secrets/config.
  - Kept `CLERK_AUDIENCE` optional because current main intentionally permits authorized-party based validation.

- `deploy/v2/scripts/preflight-env.test.mjs`
  - Kept current Clerk production preflight coverage.
  - Added runtime config scan proving Compose/Caddy do not contain placeholder/default production fallbacks.

- `deploy/v2/scripts/verify-local.sh`
  - Kept synthetic local verification.
  - Added missing Clerk redirect URL env values required by hardened Compose.
  - Ensured Caddy validation receives the same synthetic env file as Compose.

## Files Carried Forward

- `deploy/v2/Caddyfile` - removed Caddy default fallback values for ACME email and app domain.
- `deploy/v2/docker-compose.test.mjs` - added required-env interpolation coverage.
- `infrastructure/scripts/run-migration.sh` - parameterized dry-run migration runner and named-container exit-code check.
- `infrastructure/scripts/smoke-test.sh` - parameterized smoke checks with dry-run support.
- `scripts/diag/complete-diagnostic.sh` - bash syntax fix.
- `scripts/release/check-secrets-parity.sh` - includes `JWT_SECRET` in parity checks.
- `scripts/release/mobile-route-smoke.mjs` - live-probe opt-in/env guard.
- `scripts/release/probes/live-probe-env.mjs` - shared live-probe opt-in/env helper.
- `scripts/release/probes/ai_summary_probe.mjs` - live-probe opt-in/env guard.
- `scripts/release/probes/care_log_probe.mjs` - live-probe opt-in/env guard.
- `scripts/release/probes/emar_provisioning_probe.mjs` - live-probe opt-in/env guard.
- `scripts/release/probes/strict_post_deploy_matrix.mjs` - live-probe opt-in/env guard.
- `scripts/release/production-readiness-scripts.test.mjs` - release hardening regression tests.

## Files Excluded

- `apps/api/.env.development`
- `apps/api/.env.example`
- `apps/web/.env.example`
- `.playwright-mcp/`
- `apps/api/test-results/`
- `apps/web/public/`
- `libs/db/src/generated/client/*`
- `output/`
- broad docs under `docs/`
- original dirty-branch QA logs/screenshots/traces

Generated artifacts created by verification were removed from the candidate after tests ran.

## Conflicts Resolved

- `deploy/v2/docker-compose.yml`
- `deploy/v2/scripts/preflight-env.test.mjs`
- `deploy/v2/scripts/verify-local.sh`

Resolution approach:

- Preserve current `main` Clerk auth behavior.
- Apply hardening intent by requiring Deployment V2 env rather than restoring older Cognito-specific variables.
- Keep synthetic local verification compatible with required env.
- Avoid embedding live values, secrets, or real credentials.

## Verification Results

Targeted checks:

- PASS: `node --test deploy/v2/scripts/preflight-env.test.mjs`
- PASS: `node --test deploy/v2/docker-compose.test.mjs`
- PASS: `node --test scripts/release/production-readiness-scripts.test.mjs`
- PASS: `bash -n deploy/v2/scripts/verify-local.sh`
- PASS: `bash -n infrastructure/scripts/run-migration.sh`
- PASS: `bash -n scripts/diag/complete-diagnostic.sh`
- IGNORED as requested: `bash -n scripts/release/probes/live-probe-env.mjs || true`
- PASS: `node --check scripts/release/probes/live-probe-env.mjs`

Full safe local verification:

- PASS: `pnpm install --frozen-lockfile --ignore-scripts`
- PASS: `pnpm lint`
- PASS: `pnpm test`
- PASS: `pnpm build`
- FAIL then resolved: `pnpm --dir libs/db exec prisma validate` failed without `DATABASE_URL` in this clean worktree.
- PASS: `DATABASE_URL=<synthetic> pnpm --dir libs/db exec prisma validate`
- PASS: `docker compose --env-file deploy/v2/.env.synthetic -f deploy/v2/docker-compose.yml config`
- PASS: `node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env.synthetic`
- EXPECTED FAIL: missing-env Compose config failed fast.
- FAIL then fixed: `pnpm deploy:v2:verify` initially failed because Caddy validation did not receive the synthetic env file after default fallback removal.
- PASS: `pnpm deploy:v2:verify` after fixing `verify-local.sh`.
- PASS: full shell syntax sweep.

Post-cleanup verification:

- PASS: targeted Node tests.
- PASS: synthetic Compose config.
- EXPECTED FAIL: missing-env Compose config failed fast.
- PASS: `git diff --check`

Logs:

- `qa-artifacts/logs/reconcile/`

## Candidate Status

Branch is a verified local release-hardening candidate, but not clean because changes are intentionally uncommitted.

Commit recommended: YES, after human review of the dirty file list.

Push/PR recommended: YES, after commit approval.

Deploy recommended: NO. Deployment still requires a separate explicit controlled deploy approval after commit/PR review.

External review required: YES unless explicitly waived.

## Remaining Blockers

- Human review required before commit.
- No PR exists yet.
- No deploy approval has been given.
- Staging browser proof remains pending until after a controlled deploy.
