# External Review Packet: PR #34 Release Hardening

## PR

- URL: https://github.com/welathfindrr13/oasis-care-international/pull/34
- Base: `main`
- Head: `release/staging-hardening-reconciled`
- Latest commit: `a4288ce`
- Status checked: 2026-06-22

## Summary

PR #34 reconciles Deployment V2 production hardening onto current `main`. It removes unsafe placeholder production fallbacks, strengthens deployment and environment validation, hardens migration/smoke/release probe behavior, and adds regression coverage around the hardened release paths.

The follow-up CI-only commit aligns the GitHub Actions Deployment V2 verification environment with the same required Clerk redirect URL checks and passes the generated synthetic env file into Caddy validation.

## Changed Files

- `.github/workflows/ci.test.mjs`
- `.github/workflows/ci.yml`
- `deploy/v2/Caddyfile`
- `deploy/v2/docker-compose.test.mjs`
- `deploy/v2/docker-compose.yml`
- `deploy/v2/scripts/preflight-env.test.mjs`
- `deploy/v2/scripts/verify-local.sh`
- `infrastructure/scripts/run-migration.sh`
- `infrastructure/scripts/smoke-test.sh`
- `qa-artifacts/mission-state.md`
- `qa-artifacts/reconcile-plan.md`
- `qa-artifacts/test-matrix.md`
- `scripts/diag/complete-diagnostic.sh`
- `scripts/release/check-secrets-parity.sh`
- `scripts/release/mobile-route-smoke.mjs`
- `scripts/release/probes/ai_summary_probe.mjs`
- `scripts/release/probes/care_log_probe.mjs`
- `scripts/release/probes/emar_provisioning_probe.mjs`
- `scripts/release/probes/live-probe-env.mjs`
- `scripts/release/probes/strict_post_deploy_matrix.mjs`
- `scripts/release/production-readiness-scripts.test.mjs`

## CI Status

GitHub PR checks for commit `a4288ce` passed:

- `test`: passed
- `Deployment V2 verification`: passed

External review requested deployment-blocking changes after that CI run. The local review-fix verification below passed before the follow-up commit/push.

## Local Verification Evidence

Previously recorded local verification for this branch included:

- `git diff --check`
- `pnpm deploy:v2:verify`
- `node --test scripts/release/production-readiness-scripts.test.mjs`
- `node --test deploy/v2/scripts/preflight-env.test.mjs`
- `node --test deploy/v2/docker-compose.test.mjs`
- `pnpm install --frozen-lockfile --ignore-scripts`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Prisma validation with a synthetic database URL
- synthetic Compose config validation
- required-env Compose fail-fast gate
- shell syntax sweep

After the CI-only fix, targeted local verification passed:

- `git diff --check`
- `node --test .github/workflows/ci.test.mjs`
- `node --test deploy/v2/scripts/preflight-env.test.mjs deploy/v2/docker-compose.test.mjs`
- `node --test scripts/release/production-readiness-scripts.test.mjs`

After the external review fixes, targeted verification passed:

- `git diff --check`
- `node --test deploy/v2/scripts/preflight-env.test.mjs`
- `node --test deploy/v2/docker-compose.test.mjs`
- `node --test scripts/release/production-readiness-scripts.test.mjs`
- `node --test .github/workflows/ci.test.mjs`
- `bash -n deploy/v2/scripts/verify-local.sh`
- `bash -n infrastructure/scripts/run-migration.sh`
- `bash -n infrastructure/scripts/smoke-test.sh`
- `bash -n scripts/diag/complete-diagnostic.sh`
- `pnpm deploy:v2:verify`

Full safe local verification also passed:

- `pnpm install --frozen-lockfile --ignore-scripts`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Prisma validation with a synthetic database URL
- synthetic Compose config validation
- required-env Compose fail-fast gate
- shell syntax sweep

## Deployment Risk Summary

This PR changes deployment, environment validation, migration guard, smoke-test, and release-probe behavior. The risk is intentional fail-fast behavior: misconfigured staging or production env now blocks earlier instead of silently accepting unsafe placeholders.

The main deployment risk is that real staging environment values must already satisfy the stricter required-env contract before any controlled deploy. Rollback planning should account for config validation failures as a possible deploy blocker.

## Staging Parity Gap

No deploy has occurred for this PR. The staging VPS was previously observed running commit `f43fa47`, so staging has not yet received commits `2084de3` or `a4288ce`.

VPS state and untracked VPS files should be rechecked through the approved read-only lane before any controlled deploy.

## Why Deploy Remains Blocked

- PR #34 is still a draft.
- External review or explicit waiver is still required.
- No approval has been given to deploy.
- No VPS access, service restart, migration, or production data operation is approved in this gate.
- Staging browser proof for Issue #11 remains pending until after a separately approved controlled deploy.

## Reviewer Questions

1. Are Deployment V2 env requirements correctly enforced?
2. Does the Caddy validation path use synthetic/test env safely?
3. Are placeholder production fallbacks removed without breaking safe local validation?
4. Are migration/smoke/release probes safer after this change?
5. Are the tests meaningful or overfitted?
6. Is there any deployment or rollback risk before staging deploy?
7. Should this PR be approved, changed, or blocked?

## External Review REQUEST CHANGES Response

1. Compose required env set broader than preflight enforcement
   - Fix applied: `deploy/v2/scripts/preflight-env.mjs` now includes every hard-required Compose variable, including Clerk sign-up and post-auth redirect URLs. Preflight tests assert Compose `${VAR:?}` coverage cannot drift behind the preflight required set.
   - Files changed: `deploy/v2/scripts/preflight-env.mjs`, `deploy/v2/scripts/preflight-env.test.mjs`.
   - Test evidence: `node --test deploy/v2/scripts/preflight-env.test.mjs`.
   - Remaining risk: stricter preflight can block deploy if the real VPS env is incomplete, which is intentional.

2. Deploy workflow does not run preflight before compose up
   - Fix applied: `.github/workflows/deploy-vps.yml` now runs `node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env` on the VPS after pulling `main` and before `docker compose up`.
   - Files changed: `.github/workflows/deploy-vps.yml`, `.github/workflows/deploy-vps.test.mjs`.
   - Test evidence: deploy workflow regression test verifies ordering before compose up.
   - Remaining risk: controlled deploy requires Node to be available on the VPS host for the built-in-only preflight script.

3. Clerk redirect URLs runtime-required but may not be build args
   - Fix applied: Clerk public sign-up and post-auth redirect URLs are now web build args in Compose and ARG/ENV values in `apps/web/Dockerfile`, matching Next config consumption.
   - Files changed: `deploy/v2/docker-compose.yml`, `deploy/v2/docker-compose.test.mjs`, `apps/web/Dockerfile`.
   - Test evidence: Compose/Dockerfile tests assert the public Clerk redirect URLs are passed consistently.
   - Remaining risk: these values are public browser-facing configuration, so review should confirm the final staging values match Clerk dashboard routing.

4. Smoke script had hardcoded live fallback domains and no opt-in gate
   - Fix applied: `infrastructure/scripts/smoke-test.sh` no longer falls back to live domains or Terraform outputs. It requires explicit targets and requires `ALLOW_LIVE_RELEASE_PROBES=true` or `SMOKE_LIVE_OPT_IN=true` before non-dry-run network calls.
   - Files changed: `infrastructure/scripts/smoke-test.sh`, `scripts/release/production-readiness-scripts.test.mjs`.
   - Test evidence: release script tests cover explicit dry-run targets, missing target failure, no live-domain defaults, and opt-in failure before curl.
   - Remaining risk: operators must pass explicit smoke targets during real release checks.

5. Migration wrong-account guard was opt-in
   - Fix applied: non-dry-run migration execution now requires `EXPECTED_AWS_ACCOUNT_ID`; dry-run still works without it. The migration command label is no longer environment-overridable, preventing a mismatch with the actual ECS override command.
   - Files changed: `infrastructure/scripts/run-migration.sh`, `scripts/release/production-readiness-scripts.test.mjs`.
   - Test evidence: release script tests cover dry-run without expected account and non-dry-run fail-closed behavior.
   - Remaining risk: AWS/ECS migration path still requires a separate explicit approval and is outside Deployment V2 VPS deployment.

6. Preflight overlaid process env over file values and scanned too broadly
   - Fix applied: CLI preflight now validates the env file as the source of truth and limits placeholder scanning to audited Deployment V2 keys.
   - Files changed: `deploy/v2/scripts/preflight-env.mjs`, `deploy/v2/scripts/preflight-env.test.mjs`.
   - Test evidence: preflight tests prove ambient env cannot mask missing file values and unrelated ambient placeholders do not fail a valid env file.
   - Remaining risk: newly introduced Deployment V2 env keys must be added to the audited/required sets when they become deploy-critical.
