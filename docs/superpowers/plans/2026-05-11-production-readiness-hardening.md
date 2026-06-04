# Production Readiness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Oasis safe to prepare for staging/production without deploying to AWS.

**Architecture:** This sprint is a hardening and readiness pass, not a feature expansion. It separates product code from deployment risk, validates secrets by name only, locks UK GDPR boundaries, and produces a no-deploy readiness report.

**Tech Stack:** Next.js App Router, NestJS GraphQL/REST, Prisma/PostgreSQL, AWS ECS/Fargate/RDS/Secrets Manager/Terraform, GitHub Actions, Playwright/browser QA, pnpm.

---

## Scope

Included:

- clean push manifest and dirty-worktree classification,
- deployment workflow review without running deployment,
- secrets parity checks without printing secret values,
- GDPR endpoint hardening plan and tests,
- infrastructure production gap checklist,
- migration/smoke/rollback readiness review,
- access-control matrix extension,
- no-deploy readiness report.

Excluded:

- AWS deployment,
- Terraform apply,
- production workflow trigger,
- broad feature work,
- marketplace, DSCR/GP Connect, payroll, advanced rostering,
- generated Prisma client staging unless explicitly approved.

## Task 1: Resume Guard And Local Baseline

**Files:**

- Read: `docs/strategy/OASIS_ACTIVE_HANDOFF.md`
- Read: `docs/strategy/OASIS_SESSION_START.md`
- Read: `docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md`

- [x] Run `git branch --show-current`.
- [x] Confirm the branch is `feat/staging-live-setup`.
- [x] Run `git status --short`.
- [x] Confirm no AWS deploy command is running.
- [x] Confirm API health with `curl -fsS http://localhost:4000/health`.
- [x] Confirm web login route with `curl -fsS -I http://localhost:3002/login | head -n 1`.
- [x] If local services are down or stale, restart local dev only.

**Done when:** the session has known branch, dirty state, local health, and no deployment action.

## Task 2: Clean Push Classification

**Files:**

- Modify: `docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md`
- Create if useful: `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`

- [x] Run `git status --short`.
- [x] Run `git diff --stat`.
- [x] Classify dirty files into `stage-candidate`, `hold-review`, and `never-stage`.
- [x] Keep `.github/workflows/deploy-production.yml` in `hold-review`.
- [x] Keep env files in `hold-review`.
- [x] Keep generated Prisma client files in `hold-review` or `never-stage` unless policy is confirmed.
- [x] Keep `_reports`, `artifacts`, `output`, `.playwright-mcp`, screenshots, and local diagnostics in `never-stage`.
- [x] Document the exact classification in `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`.

**Done when:** a future commit can be staged intentionally without dragging in artifacts, env files, generated files, or deployment leftovers.

## Task 3: Deployment Workflow Review Without Deploying

**Files:**

- Inspect: `.github/workflows/docker-ecr.yml`
- Inspect: `.github/workflows/deploy-production.yml`
- Inspect: `docs/DEPLOY_CHECKLIST.md`
- Inspect: `docs/PRODUCTION_RELEASE_RUNBOOK.md`
- Modify: `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`

- [x] Confirm staging workflow requires explicit checklist confirmation for manual dispatch.
- [x] Confirm production workflow requires signed tag or manual release tag and checklist confirmation.
- [x] Confirm no workflow should be triggered from this branch by this task.
- [x] Confirm deployment uses immutable image digests.
- [x] Confirm rollback procedure identifies prior task definitions or image digests.
- [x] Record workflow gaps in `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`.

**Done when:** deployment paths are documented as present, reviewed, and not executed.

## Task 4: Secrets Parity Review Without Secret Exposure

**Files:**

- Inspect: `scripts/release/check-secrets-parity.sh`
- Inspect: `ENV-Matrix.md`
- Inspect: `infrastructure/staging/secrets.tf`
- Modify: `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`

- [x] Verify required secret names in code/docs.
- [x] Do not print secret values.
- [x] Confirm the checker covers staging names:
  - `oasis/staging/COGNITO_CLIENT_SECRET`
  - `oasis/staging/DATABASE_URL`
  - `oasis/staging/NEXTAUTH_SECRET`
  - `oasis/staging/NEXTAUTH_URL`
- [x] Confirm the checker can run production parity with `CHECK_PRODUCTION=true`.
- [x] Identify any missing required production secret names without exposing values.
- [x] Record any drift between env examples, ECS task definitions, and secret checker.

**Done when:** secret presence can be checked safely by name, with no values exposed in logs.

## Task 5: Reliability Workflow Secret Hygiene

**Files:**

- Modify: `.github/workflows/staging-reliability-soak.yml` only if this task is explicitly allowed for deployment/workflow hardening.
- Modify: `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`

- [x] Inspect reliability workflow env vars.
- [ ] Move demo-looking usernames/passwords to GitHub secrets references if workflow edits are approved.
- [x] If workflow edits are not approved, document the exact change needed.
- [x] Ensure reliability artifacts remain uploaded and no credentials are logged.

**Done when:** reliability workflow credential risk is either fixed or documented as a blocker.

## Task 6: UK GDPR Endpoint Hardening

**Files:**

- Inspect/modify: `apps/api/src/gdpr/gdpr.controller.ts`
- Inspect/modify: `apps/api/src/gdpr/services/*.ts`
- Test: create or extend `apps/api/src/gdpr/*.spec.ts`
- Modify: `docs/gdpr/TECH_CHECKLIST.md`
- Modify: `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`

- [x] Confirm `GdprModule` is only enabled when `GDPR_ENABLED=true`.
- [x] Add or document auth guard requirements for every `/gdpr/*` endpoint.
- [x] Ensure SAR/erasure requests can only be made by authorised staff or the data subject/proper representative.
- [x] Ensure one user cannot request another user's SAR/erasure without staff authority.
- [x] Add tests for unauthenticated denial.
- [x] Add tests for cross-subject denial.
- [x] Add tests for authorised staff path.
- [ ] Document DPIA, privacy notice, DPA/controller-processor position, retention policy, SAR/erasure procedure, family-access authority rules, and medication visibility policy as production gates.

**Done when:** GDPR endpoints are safe to enable or explicitly remain disabled until hardening is complete.

## Task 7: Infrastructure Production Gap Checklist

**Files:**

- Inspect: `infrastructure/staging/rds.tf`
- Inspect: `infrastructure/staging/cloudwatch.tf`
- Inspect: `infrastructure/staging/ecs-service.tf`
- Modify: `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`

- [x] Record staging RDS settings that are not production-grade:
  - `deletion_protection=false`,
  - `skip_final_snapshot=true`,
  - `multi_az=false`.
- [x] Confirm encryption and backup retention are present.
- [x] Record production decision needed for Multi-AZ.
- [x] Replace or document placeholder alert destination.
- [x] Confirm log retention policy is acceptable or document required duration.
- [x] Confirm backup restore test is still required before production.

**Done when:** infrastructure risks are visible before anyone attempts production.

## Task 8: Migration, Smoke, And Rollback Readiness

**Files:**

- Inspect: `infrastructure/scripts/run-migration.sh`
- Inspect: `infrastructure/scripts/smoke-test.sh`
- Inspect: `docs/PRODUCTION_RELEASE_RUNBOOK.md`
- Modify: `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`

- [x] Confirm migration script runs Prisma migrate deploy in ECS task context.
- [x] Confirm smoke script checks API health and GraphQL.
- [x] Add or document web `/api/health` smoke check if missing.
- [x] Confirm rollback runbook identifies task-definition/digest rollback steps.
- [x] Document any hardcoded staging domains that must be parameterised before production.

**Done when:** migration, smoke, and rollback are clear enough for a deployment owner to rehearse safely.

## Task 9: Access-Control Matrix Extension

**Files:**

- Inspect/modify: `apps/api/src/carebridge/**`
- Inspect/modify: `apps/api/src/care-log/**`
- Inspect/modify: `apps/api/src/medication/**`
- Inspect/modify: `apps/api/src/visit/**`
- Test: relevant API spec files.

- [x] Verify family cannot query raw visits.
- [x] Verify family cannot query raw care logs.
- [x] Verify family cannot query raw medication administrations or audit rows.
- [x] Verify family cannot query staff/admin/reporting data.
- [x] Verify family cannot query care-planning internals.
- [x] Verify revoked family access blocks next query.
- [x] Add future-proof negative test if medication audit read resolver is introduced.

**Done when:** CareBridge remains a governed projection layer.

## Task 10: No-Deploy Readiness Report

**Files:**

- Create: `docs/strategy/OASIS_NO_DEPLOY_READINESS_REPORT.md`

- [x] Summarise local verification results.
- [x] Summarise deployment assets present.
- [x] Summarise secrets parity status by name only.
- [x] Summarise UK GDPR readiness and blockers.
- [x] Summarise infrastructure production gaps.
- [x] Summarise dirty-worktree staging guidance.
- [x] State clearly that no AWS deployment was performed.

**Done when:** the user can see exactly what is ready, what is blocked, and what remains before production.

## Required Verification Before Claiming Sprint Completion

Run:

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/api build
pnpm --filter @oasis/web build
```

Browser QA:

- `/login`
- `/today`
- `/people`
- `/schedule`
- visit detail route
- `/medication`
- `/family-updates`
- `/care-planning`
- `/evidence`
- `/settings`

Do not claim production readiness unless deployment, GDPR, reliability, access-control, backups, monitoring, and clean-push gates are all satisfied.

## Follow-Up 1: Secret Parity And Script Parameterisation

Completed on 2026-05-11:

- [x] Added `JWT_SECRET` to `scripts/release/check-secrets-parity.sh`.
- [x] Added `scripts/release/production-readiness-scripts.test.mjs`.
- [x] Parameterised `infrastructure/scripts/run-migration.sh` with region, account, cluster, task definition, container, subnet, security group, and dry-run support.
- [x] Parameterised `infrastructure/scripts/smoke-test.sh` with API, web, GraphQL, dry-run, timeout, and optional schema introspection support.
- [x] Verified staging secret names by name only, including `JWT_SECRET`.
- [x] Verified production secret parity fails safely with five missing names and no secret values printed.
- [x] Kept deployment workflow files in hold-review.

## Follow-Up 2: Product Safety Pass

Completed on 2026-05-11:

- [x] Ran `pnpm --dir libs/db exec prisma validate`.
- [x] Ran `pnpm --filter @oasis/api test`.
- [x] Ran `pnpm --filter @oasis/api build`.
- [x] Ran `pnpm --filter @oasis/web build`.
- [x] Found local browser login was blocked by stale generated `.next` chunks after build/dev overlap.
- [x] Moved the generated `apps/web/.next` cache aside and restarted local API/web dev servers.
- [x] Confirmed local admin login reaches `/today`.
- [x] Browser-checked `/today`, `/people`, `/schedule`, `/medication`, `/family-updates`, `/care-planning`, `/evidence`, and `/settings`.
- [x] Browser-checked visit detail `/schedule/d83ce546-2de7-4507-af97-523327884d25` loads the `Care Visit` workflow after client-side data fetch completes.
- [x] Browser-checked local family login lands on `/family`.
- [x] Browser-checked local family attempts to open `/today` and `/schedule` redirect back to `/family`.
- [x] Confirmed no AWS deployment was performed.
