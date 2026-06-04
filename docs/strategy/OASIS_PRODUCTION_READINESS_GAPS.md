# Oasis Production Readiness Gaps

Last reviewed: 2026-05-11

Branch: `feat/staging-live-setup`

No AWS deployment was performed while preparing this document. Checks in this file are review, local validation, or name-only AWS Secrets Manager presence checks.

## Executive Status

Oasis has the bones of a deployable AWS path, but it is not production-ready yet.

Current posture:

- Staging deployment workflow exists and deploys immutable image digests.
- Production signed-tag workflow exists as a hold-review file, but must not be staged or used until deployment is explicitly approved.
- Staging secret presence passed for the five names currently checked, including `JWT_SECRET`.
- Production secret parity failed because production secret names are not present yet.
- Production workflow is missing the staging workflow's post-deploy digest verification and smoke checks.
- Reliability soak workflow contains demo-looking credentials directly in workflow env and must be moved to GitHub secrets before use.
- Infrastructure production hardening and GDPR endpoint hardening still need separate review.
- Full local product-safety validation passed on 2026-05-11 after a clean local restart; no AWS deployment was performed.

## Deployment Workflow Review

Reviewed:

- `.github/workflows/docker-ecr.yml`
- `.github/workflows/deploy-production.yml`
- `docs/DEPLOY_CHECKLIST.md`
- `docs/PRODUCTION_RELEASE_RUNBOOK.md`

### Staging Workflow

What is good:

- Manual dispatch requires `confirm_checklist`.
- Push trigger is limited to `main` and relevant paths.
- AWS auth prefers OIDC role via `AWS_DEPLOY_ROLE_ARN_STAGING`, with static key fallback.
- Workflow verifies AWS account ID before deploying.
- Workflow refuses to build if the checkout is dirty.
- Workflow runs `scripts/release/check-secrets-parity.sh` before image build.
- API and web images are built and pushed with both mutable `staging` tags and immutable `sha-*` tags.
- ECS task definitions are updated to image digests using `repo@sha256:<digest>`.
- Services wait for stability.
- Running task image digests are checked against expected digests.
- API `/health` and web `/api/health` smoke checks are present.

Gaps:

- Staging deploy still has a `push` trigger on `main`. That is normal for CI/CD, but the branch must not be merged until the clean-push manifest has excluded env/artifact/generated/deploy noise.
- Build args hardcode `https://api.oasis-care.co/graphql` and `https://app.oasis-care.co`. This is acceptable for staging only if those domains are intentionally staging targets; otherwise parameterise before production.

### Production Workflow

What is good:

- Production deploy is tag-driven on `v*` or manual dispatch with `release_tag`.
- Preflight imports `RELEASE_SIGNING_PUBKEY`.
- Preflight calls `scripts/release/preflight.sh` to enforce signed tag and clean tree.
- Manual dispatch requires `confirm_checklist`.
- AWS auth prefers `AWS_DEPLOY_ROLE_ARN_PROD`, with static key fallback.
- Production secret parity check runs with `CHECK_STAGING=false CHECK_PRODUCTION=true`.
- ECS services are deployed by immutable image digest.
- Deployment target names are read from GitHub environment variables or explicit workflow inputs.

Gaps:

- Production workflow is currently untracked and must stay in hold-review until deployment work is explicitly approved.
- Production workflow does not verify the running ECS task image digests after deployment.
- Production workflow does not run API `/health`, web `/api/health`, or role-matrix smoke checks after deployment.
- Production workflow uses the same hardcoded web build args as staging: `https://api.oasis-care.co/graphql` and `https://app.oasis-care.co`. Confirm these are production domains before use.
- Production workflow does not upload deployment summary artifacts containing release tag, digests, task definition revisions, and smoke results.

Required before production:

- Add post-deploy running digest verification to production workflow.
- Add production smoke checks to production workflow.
- Record release tag, image digests, and task definition revisions in workflow output/artifacts.
- Confirm production ECS cluster/service GitHub variables exist: `PROD_ECS_CLUSTER`, `PROD_ECS_API_SERVICE`, `PROD_ECS_WEB_SERVICE`.

## Secrets Parity Review

Reviewed:

- `scripts/release/check-secrets-parity.sh`
- `ENV-Matrix.md`
- `infrastructure/staging/secrets.tf`
- `infrastructure/staging/ecs-service.tf`

### Name-Only Secret Checks Run

Staging command run:

```bash
AWS_REGION=eu-west-2 bash scripts/release/check-secrets-parity.sh
```

Result:

- `oasis/staging/COGNITO_CLIENT_SECRET`: present
- `oasis/staging/DATABASE_URL`: present
- `oasis/staging/JWT_SECRET`: present
- `oasis/staging/NEXTAUTH_SECRET`: present
- `oasis/staging/NEXTAUTH_URL`: present

No secret values were printed.

Production command run:

```bash
AWS_REGION=eu-west-2 CHECK_STAGING=false CHECK_PRODUCTION=true bash scripts/release/check-secrets-parity.sh
```

Result:

- `oasis/production/COGNITO_CLIENT_SECRET`: missing
- `oasis/production/DATABASE_URL`: missing
- `oasis/production/JWT_SECRET`: missing
- `oasis/production/NEXTAUTH_SECRET`: missing
- `oasis/production/NEXTAUTH_URL`: missing

No secret values were printed.

### Secret Drift

Current checker requires:

- `COGNITO_CLIENT_SECRET`
- `DATABASE_URL`
- `JWT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

ECS staging API task also consumes:

- `JWT_SECRET`

Resolved in follow-up: `scripts/release/check-secrets-parity.sh` now requires `JWT_SECRET` for staging and production checks.

Required before production:

- Create production equivalents for all required secrets before production deploy:
  - `oasis/production/COGNITO_CLIENT_SECRET`
  - `oasis/production/DATABASE_URL`
  - `oasis/production/JWT_SECRET`
  - `oasis/production/NEXTAUTH_SECRET`
  - `oasis/production/NEXTAUTH_URL`
- Align `ENV-Matrix.md` with current local ports and current AWS/ECS deployment shape.
- Review whether `NEXTAUTH_URL` should be a secret or a plain environment variable. It is treated as a secret by the checker but as plain ECS env in `infrastructure/staging/ecs-service.tf`.

## Reliability Workflow Secret Hygiene

Reviewed:

- `.github/workflows/staging-reliability-soak.yml`

Current risk:

- The workflow stores demo-looking credentials directly in job-level env:
  - `PLAYWRIGHT_ADMIN_EMAIL`
  - `PLAYWRIGHT_ADMIN_PASSWORD`
  - `PLAYWRIGHT_CARER_EMAIL`
  - `PLAYWRIGHT_CARER_PASSWORD`

Required before enabling or relying on the soak workflow:

- Move credentials to GitHub secrets:
  - `STAGING_PLAYWRIGHT_ADMIN_EMAIL`
  - `STAGING_PLAYWRIGHT_ADMIN_PASSWORD`
  - `STAGING_PLAYWRIGHT_CARER_EMAIL`
  - `STAGING_PLAYWRIGHT_CARER_PASSWORD`
- Keep `PLAYWRIGHT_BASE_URL` as a workflow variable or env if it is not sensitive.
- Ensure the generated `_soak_context.txt` never prints passwords.
- Confirm uploaded reliability artifacts do not include screenshots or traces containing credentials.

Proposed workflow env shape:

```yaml
env:
  PLAYWRIGHT_BASE_URL: https://app.oasis-care.co
  PLAYWRIGHT_ADMIN_EMAIL: ${{ secrets.STAGING_PLAYWRIGHT_ADMIN_EMAIL }}
  PLAYWRIGHT_ADMIN_PASSWORD: ${{ secrets.STAGING_PLAYWRIGHT_ADMIN_PASSWORD }}
  PLAYWRIGHT_CARER_EMAIL: ${{ secrets.STAGING_PLAYWRIGHT_CARER_EMAIL }}
  PLAYWRIGHT_CARER_PASSWORD: ${{ secrets.STAGING_PLAYWRIGHT_CARER_PASSWORD }}
```

This workflow was not modified because deployment/workflow edits are currently hold-review.

## Infrastructure Production Gap Checklist

Reviewed:

- `infrastructure/staging/rds.tf`
- `infrastructure/staging/cloudwatch.tf`
- `infrastructure/staging/ecs-service.tf`
- `infrastructure/staging/variables.tf`

### RDS

Present:

- RDS is private: `publicly_accessible = false`.
- Storage encryption is enabled: `storage_encrypted = true`.
- Backups are enabled with `backup_retention_period = 7`.
- Backup and maintenance windows are explicitly set.

Staging settings that are not production-grade:

- `deletion_protection = false`
- `skip_final_snapshot = true`
- `multi_az = false`
- `allocated_storage = 20`
- `instance_class = db.t3.micro`

Required before production:

- Decide whether production RDS uses Multi-AZ. For a real paid care platform, default should be Multi-AZ unless cost explicitly blocks it.
- Enable deletion protection for production.
- Require a final snapshot on destroy for production.
- Pick production instance size and storage based on expected pilot load.
- Run and document one backup restore rehearsal before production go-live.

### CloudWatch And Alerts

Present:

- RDS CPU, storage, memory, and connection alarms exist.
- ALB target 5xx and target response-time alarms exist.
- ECS API CPU and memory alarms exist.
- Alerts publish to an SNS topic.

Gaps:

- SNS email subscription still uses placeholder-style endpoint `admin@oasis-care.co`.
- `variables.tf` defines `sns_topic_arn`, but `cloudwatch.tf` creates its own SNS topic and does not use the variable.
- API and web log groups retain logs for 14 days. This may be acceptable for staging, but production retention needs an explicit UK GDPR/security decision.
- Web ECS service does not have separate CPU/memory alarms; current ECS alarms target the API service only.

Required before production:

- Replace placeholder alert recipient with a real monitored mailbox or incident channel.
- Decide whether alerts should use managed topic variable `var.sns_topic_arn` or Terraform-created topic, then remove ambiguity.
- Add web service ECS alarms or document why ALB/service health covers it.
- Decide production log retention duration and document the GDPR/security rationale.

### ECS

Present:

- API and web services run in private subnets.
- ECS task definitions have container health checks.
- ECS service desired count is ignored by Terraform lifecycle, which is useful for deploy workflows that manage service revisions.

Gaps:

- Desired count defaults to `1`, which is fragile for production unless cost constraints deliberately require single-task operation.
- ECS Exec is enabled for both API and web. This is useful for support but should be governed by IAM, audit logging, and an incident/debug policy.

Required before production:

- Decide production desired count and autoscaling policy.
- Confirm ECS Exec access is restricted and audited.
- Confirm CloudWatch alarm coverage includes both API and web services.

## Migration, Smoke, And Rollback Readiness

Reviewed:

- `infrastructure/scripts/run-migration.sh`
- `infrastructure/scripts/smoke-test.sh`
- `docs/PRODUCTION_RELEASE_RUNBOOK.md`
- `.github/workflows/docker-ecr.yml`
- `.github/workflows/deploy-production.yml`

### Migration Runner

Present:

- `infrastructure/scripts/run-migration.sh` runs `npx prisma migrate deploy` as a one-off ECS Fargate task.
- The task can use explicit `SUBNET_ID` and `SECURITY_GROUP_ID` inputs, or fall back to Terraform outputs for private subnet and ECS security group.
- The task supports `AWS_REGION`, `EXPECTED_AWS_ACCOUNT_ID`, `CLUSTER`, `TASK_DEF`, and `CONTAINER_NAME` inputs.
- The task supports `MIGRATION_DRY_RUN=true` for no-AWS/no-Terraform release rehearsal output.
- It waits for the task to stop and checks the API container exit code.

Gaps:

- Defaults remain staging-oriented:
  - `oasis-care-staging-cluster`
  - `oasis-care-staging-api`
- Production release owners must pass explicit production values rather than relying on defaults.
- Script does not record the migration task ARN, task definition revision, or CloudWatch log link into a release artifact.

Required before production:

- Wire production release procedure to pass explicit production migration inputs.
- Record migration task ARN, task definition revision, and logs in release notes.

### Smoke Script

Present:

- `infrastructure/scripts/smoke-test.sh` checks API health, web health, and GraphQL `__typename`.
- It supports explicit `API_BASE_URL`, `WEB_BASE_URL`, and `GRAPHQL_ENDPOINT`.
- It can fall back to Terraform `graphql_endpoint`.
- It supports `SMOKE_DRY_RUN=true` for no-network release rehearsal output.
- Schema introspection is optional via `GRAPHQL_SCHEMA_INTROSPECTION=true`, so production can keep introspection disabled.

Gaps:

- Smoke script does not run the strict role matrix subset.
- Defaults remain `https://api.oasis-care.co` and `https://app.oasis-care.co`; production release owners must pass explicit values if these are not production domains.

Required before production:

- Add strict role/access matrix smoke subset.
- Wire smoke script into production workflow or release runbook with explicit production URLs.

### Rollback

Present:

- `docs/PRODUCTION_RELEASE_RUNBOOK.md` identifies rollback by last known-good task definition revisions.
- The runbook includes ECS service update and `services-stable` wait commands.

Gaps:

- The production workflow does not persist last-known-good task definition ARNs before update.
- The runbook does not include a command to list previous task definition revisions and select the prior known-good revision.
- Rollback smoke checks are described but not scripted.

Required before production:

- Capture old API and web task definition ARNs during deployment.
- Record old/new task definition ARNs and image digests in deployment summary.
- Add scripted rollback smoke checks using the same smoke inputs as deployment.

## Access-Control Matrix Extension

Reviewed and verified:

- `apps/api/test/carebridge-access-hardening.spec.ts`
- `apps/api/src/auth/legacy-operational-access.ts`
- `apps/api/src/care-log/**`
- `apps/api/src/care-planning/**`
- `apps/api/src/carebridge/**`
- `apps/api/src/medication/**`
- `apps/api/src/visit/**`

Targeted access-control tests run:

```bash
pnpm --filter @oasis/api test -- --runInBand test/carebridge-access-hardening.spec.ts src/gdpr/gdpr.controller.spec.ts src/auth/legacy-operational-access.spec.ts src/auth/api-roles.guard.spec.ts src/care-log/care-log.service.spec.ts src/care-planning/__tests__/care-planning.service.spec.ts src/carebridge/access/carebridge-access.service.spec.ts src/carebridge/feed/carebridge-feed.service.spec.ts
```

Result:

- 8 test suites passed.
- 40 tests passed.

Coverage confirmed:

- Family/external users are blocked from legacy raw operational GraphQL surfaces.
- Raw visit queries remain staff-only.
- Raw care-log queries and monthly summaries remain staff-only.
- Medication administration and medication list operations remain staff-only.
- Care-planning internals remain staff-only.
- Staff/admin reporting remains outside external access.
- CareBridge family access still uses scoped membership/grants.
- Medication support in family-facing stories remains status-only when visible.
- No raw medication-audit resolver exists for family users.

Remaining production gate:

- Browser/API smoke should still include a live family-session probe against raw operational GraphQL operations before any deploy.

## Open Production Gates

- Finish GDPR service-level hardening before enabling `GDPR_ENABLED=true`. Controller endpoints are now guarded for `admin`/`manager`, but self-service/proper-representative SAR and erasure access remains blocked until the authority model is implemented.
- Complete backup restore rehearsal and document result.
- Wire parameterised migration/smoke scripts into the release procedure and add strict role/access smoke checks.
- Add live post-deploy family-session raw GraphQL denial smoke probes before production.
- Produce `docs/strategy/OASIS_NO_DEPLOY_READINESS_REPORT.md` after the hardening review is complete.
