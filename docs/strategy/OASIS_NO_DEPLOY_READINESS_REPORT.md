# Oasis No-Deploy Readiness Report

Last reviewed: 2026-05-11

Branch: `feat/staging-live-setup`

No AWS deployment was performed. No Terraform apply was run. No GitHub deployment workflow was triggered.

## Local Verification

Local health checks run:

```bash
curl -fsS http://localhost:4000/health
curl -fsS -I http://localhost:3002/login | head -n 1
```

Results:

- API health returned `{"status":"ok","version":"unknown","commitSha":"unknown","environment":"development"}`.
- Web login route returned `HTTP/1.1 200 OK`.

Targeted API tests run:

```bash
pnpm --filter @oasis/api test -- --runInBand test/carebridge-access-hardening.spec.ts src/gdpr/gdpr.controller.spec.ts src/auth/legacy-operational-access.spec.ts src/auth/api-roles.guard.spec.ts src/care-log/care-log.service.spec.ts src/care-planning/__tests__/care-planning.service.spec.ts src/carebridge/access/carebridge-access.service.spec.ts src/carebridge/feed/carebridge-feed.service.spec.ts
```

Result:

- 8 test suites passed.
- 40 tests passed.

Build/schema checks run:

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/api build
pnpm --filter @oasis/web build
```

Result:

- Prisma schema is valid.
- API test suite passed: 26 suites, 173 tests.
- API build passed.
- Web build passed.

Browser QA run in the in-app browser:

- `/login` rendered as the polished local-auth screen.
- Local admin `Continue` reached `/today`.
- `/today`, `/people`, `/schedule`, `/medication`, `/family-updates`, `/care-planning`, `/evidence`, and `/settings` loaded without runtime errors.
- Visit detail `/schedule/d83ce546-2de7-4507-af97-523327884d25` loaded the `Care Visit` workflow after client-side data fetch completed.
- Local family login landed on `/family`.
- Family attempts to open `/today` and `/schedule` redirected to `/family`.
- Family shell did not show staff navigation.

Local browser issue found and resolved:

- Root cause: running `pnpm --filter @oasis/web build` while the dev server was open left stale `.next` chunks in the active browser/dev-server session.
- Fix used locally: move the generated `apps/web/.next` cache aside and restart web/API dev servers.
- No source-code auth change was required.

## Deployment Assets Present

Present:

- Staging ECS/ECR workflow: `.github/workflows/docker-ecr.yml`.
- Production signed-tag workflow draft: `.github/workflows/deploy-production.yml`.
- Secrets parity checker: `scripts/release/check-secrets-parity.sh`.
- Staging ECS Secrets Manager references: `infrastructure/staging/secrets.tf`, `infrastructure/staging/ecs-service.tf`.
- Migration runner: `infrastructure/scripts/run-migration.sh`.
- Smoke script: `infrastructure/scripts/smoke-test.sh`.
- Release runbook: `docs/PRODUCTION_RELEASE_RUNBOOK.md`.
- Deployment checklist: `docs/DEPLOY_CHECKLIST.md`.
- Reliability docs: `docs/RELIABILITY_GATES.md`, `docs/OBSERVABILITY_SLOS.md`, `docs/SUPPORT_HANDOFF.md`.

Hold-review:

- `.github/workflows/deploy-production.yml` is untracked and must not be staged or used until deployment is explicitly approved.
- Dockerfiles, env examples, local startup scripts, and generated Prisma client output remain hold-review per `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`.

## Secrets Parity Status

Name-only staging check run:

```bash
AWS_REGION=eu-west-2 bash scripts/release/check-secrets-parity.sh
```

Staging result:

- `oasis/staging/COGNITO_CLIENT_SECRET`: present
- `oasis/staging/DATABASE_URL`: present
- `oasis/staging/JWT_SECRET`: present
- `oasis/staging/NEXTAUTH_SECRET`: present
- `oasis/staging/NEXTAUTH_URL`: present

Name-only production check run:

```bash
AWS_REGION=eu-west-2 CHECK_STAGING=false CHECK_PRODUCTION=true bash scripts/release/check-secrets-parity.sh
```

Production result:

- `oasis/production/COGNITO_CLIENT_SECRET`: missing
- `oasis/production/DATABASE_URL`: missing
- `oasis/production/JWT_SECRET`: missing
- `oasis/production/NEXTAUTH_SECRET`: missing
- `oasis/production/NEXTAUTH_URL`: missing

No secret values were printed.

Secret-readiness gaps:

- `JWT_SECRET` is now included in the secret parity checker.
- Create production equivalents before any production deployment.
- Decide whether `NEXTAUTH_URL` should be treated as secret or plain config.

## UK GDPR Readiness

Improved in this sprint:

- `GdprModule` remains feature-flagged by `GDPR_ENABLED=true`.
- `GdprController` now uses `ApiRolesGuard`.
- `/gdpr/*` endpoints are restricted to `admin` and `manager`.
- Unauthenticated callers and non-manager/non-admin users are denied before SAR/erasure work is enqueued.
- Targeted tests cover GDPR guard metadata, role metadata, unauthenticated denial, non-staff denial, and authorised manager erasure path.

Remaining GDPR production blockers:

- Self-service data-subject SAR/erasure is intentionally not enabled yet.
- Proper-representative/family/attorney access needs the CareBridge-style authority model before production.
- DPIA, privacy notice, DPA/controller-processor position, retention policy, SAR/erasure operating procedure, family-access authority rules, and medication visibility policy must be completed before production.
- Service-level erasure/export behavior still needs a deeper legal/technical review before `GDPR_ENABLED=true` is used in production.

## Infrastructure Production Gaps

RDS staging settings that are not production-grade:

- `deletion_protection = false`
- `skip_final_snapshot = true`
- `multi_az = false`
- `allocated_storage = 20`
- `instance_class = db.t3.micro`

Present:

- RDS storage encryption is enabled.
- RDS backup retention is set to 7 days.
- ECS services run in private subnets.
- API and web containers have health checks.

Production blockers:

- Decide and configure production Multi-AZ.
- Enable production deletion protection.
- Require final snapshots for production.
- Run and document a backup restore rehearsal.
- Replace placeholder alert destination.
- Add or document web-service ECS alarms.
- Decide production log retention duration.
- Confirm ECS Exec is restricted and audited.

## Migration, Smoke, And Rollback

Present:

- Migration script runs `npx prisma migrate deploy` in an ECS Fargate task and supports explicit production inputs plus `MIGRATION_DRY_RUN=true`.
- Smoke script checks API health, web health, and GraphQL `__typename`; supports explicit production inputs plus `SMOKE_DRY_RUN=true`.
- Runbook describes digest-based deployment and rollback to known-good task definitions.

Production blockers:

- Smoke script does not run strict role/access matrix probes.
- Production release owners must pass explicit production cluster/task/URL inputs rather than relying on staging defaults.
- Production workflow does not persist old task definition ARNs or run post-deploy digest/smoke checks.

## Access-Control Readiness

Confirmed by targeted tests:

- Family/external users are blocked from legacy raw operational GraphQL surfaces.
- Raw visit, care-log, medication, care-planning, staff, and reporting surfaces remain staff-only.
- CareBridge family access remains scoped through membership/grants.
- Medication support in family-facing updates remains status-only where visible.
- No raw medication-audit resolver exists for family users.

Production blocker:

- Add live post-deploy smoke probes using a family session to confirm raw GraphQL operational queries are denied in the deployed environment.

## Dirty Worktree Guidance

The current worktree remains intentionally dirty and must not be staged with `git add .`.

Read before staging:

- `docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md`
- `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`

Known never-stage categories:

- `.playwright-mcp/**`
- `_reports/**`
- `artifacts/**`
- `output/**`
- `apps/api/test-results/junit.xml`
- `libs/db/src/generated/client/**` unless repo policy explicitly requires generated client output
- env files unless explicitly approved
- deployment workflow files unless explicitly approved

## Next Best Step

The product safety pass is complete locally. The next clean production-readiness task is to split the remaining work into two small passes:

1. Clean push isolation: prepare a reviewable file set using `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`, excluding generated/client/artifact/deploy noise.
2. Release procedure pass: wire parameterised migration/smoke scripts into the production workflow/runbook, add role-matrix smoke probes, and create production secret names when deployment is approved.

Do not deploy to AWS until the user explicitly approves it.
