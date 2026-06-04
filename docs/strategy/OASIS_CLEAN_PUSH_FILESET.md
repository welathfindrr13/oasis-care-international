# Oasis Clean Push Fileset

Last reviewed: 2026-05-11

Branch: `feat/staging-live-setup`

Purpose: give future Codex sessions an exact staging map so Oasis can keep moving without accidentally committing local noise, generated churn, env drift, or deployment work. This file is a staging guide, not permission to deploy.

## Current Rule

No AWS deployment, Terraform apply, production workflow trigger, or ECS/RDS change is allowed until the user explicitly approves deployment and confirms the AWS cost constraint is resolved.

## Stage-Candidate Groups

These files are likely part of the product/platform push, but each diff still needs review before staging.

### Product API Source

- `apps/api/src/ai-summary/**`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/**`
- `apps/api/src/care-log/**`
- `apps/api/src/care-planning/**`
- `apps/api/src/carebridge/**`
- `apps/api/src/carer/**`
- `apps/api/src/client/**`
- `apps/api/src/common/**`
- `apps/api/src/demo/demo-seed.controller.ts`
- `apps/api/src/health/**`
- `apps/api/src/main.ts`
- `apps/api/src/medication/**`
- `apps/api/src/metrics/**`
- `apps/api/src/shift/**`
- `apps/api/src/stats/**`
- `apps/api/src/visit/**`

### API Tests

- `apps/api/test/auth.guard.mock.ts`
- `apps/api/test/carebridge-access-hardening.spec.ts`
- `apps/api/test/emar.e2e.spec.ts`
- `apps/api/test/fixtures.ts`
- `apps/api/test/health.e2e-spec.ts`
- `apps/api/test/jwt.mock.ts`
- `apps/api/test/medication.e2e-spec.ts`
- `apps/api/test/stats.e2e.spec.ts`
- `apps/api/test/utils/test-container.ts`
- `apps/api/test/visit.e2e.spec.ts`
- `apps/api/test/visit.resolver.spec.ts`
- `apps/api/test/visit.service.spec.ts`
- `apps/api/src/**/*.spec.ts`

Do not include generated test outputs such as `apps/api/test-results/junit.xml`.

### Web Product Source

- `apps/web/app/activity/**`
- `apps/web/app/admin/**`
- `apps/web/app/api/**`
- `apps/web/app/care-planning/**`
- `apps/web/app/clients/**`
- `apps/web/app/dashboard/**`
- `apps/web/app/emar/**`
- `apps/web/app/evidence/**`
- `apps/web/app/family/**`
- `apps/web/app/family-updates/**`
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/people/**`
- `apps/web/app/schedule/**`
- `apps/web/app/settings/**`
- `apps/web/app/today/**`
- `apps/web/app/visits/**`
- `apps/web/components/**`
- `apps/web/lib/**`
- `apps/web/middleware.ts`
- `apps/web/next.config.js`

### Auth And Shared Library Source

- `libs/auth/src/**`
- `libs/auth/package.json`

### Database Source Of Truth

- `libs/db/prisma/schema.prisma`
- `libs/db/prisma/migrations/**`
- `libs/db/prisma/seed.ts`

The Prisma schema, migrations, and seed are stage candidates. Generated Prisma client output is not.

### Dependency Manifests

- `apps/web/package.json`
- `libs/auth/package.json`
- `pnpm-lock.yaml`

Only stage dependency manifests after checking the package change is intentional and the lockfile does not contain unrelated dependency churn.

### Strategy And Product Docs

- `docs/strategy/OASIS_ACTIVE_HANDOFF.md`
- `docs/strategy/OASIS_BRANCH_GUARDRAILS.md`
- `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`
- `docs/strategy/OASIS_CLEAN_PUSH_ISOLATION_2026-05-11.md`
- `docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md`
- `docs/strategy/OASIS_EXECUTION_RAIL.md`
- `docs/strategy/OASIS_PLATFORM_NORTH_STAR.md`
- `docs/strategy/OASIS_SESSION_START.md`
- `docs/superpowers/plans/2026-05-06-care-spine-push.md`
- `docs/superpowers/plans/2026-05-11-production-readiness-hardening.md`

### Production Readiness Docs

These are stage candidates only for a production-readiness commit, not for a pure product-feature commit.

- `docs/BUYER_ACCEPTANCE_EVIDENCE.md`
- `docs/DEPLOY_CHECKLIST.md`
- `docs/OBSERVABILITY_SLOS.md`
- `docs/PRODUCTION_RELEASE_RUNBOOK.md`
- `docs/RELIABILITY_GATES.md`
- `docs/SUPPORT_HANDOFF.md`
- `docs/gdpr/**`

### Production Readiness Scripts

These are stage candidates only for a production-readiness commit. They are deployment-adjacent, so review carefully and do not run deploy actions while staging them.

- `scripts/release/check-secrets-parity.sh`
- `scripts/release/production-readiness-scripts.test.mjs`
- `infrastructure/scripts/run-migration.sh`
- `infrastructure/scripts/smoke-test.sh`

## Hold-Review Paths

These may be intentional later, but do not stage them in the next product push unless the user explicitly approves that scope.

### Deployment And Infrastructure

- `.github/workflows/deploy-production.yml`
- `.dockerignore`
- `apps/api/Dockerfile`
- `apps/api/docker-entrypoint.sh`
- `apps/web/Dockerfile`
- `scripts/release/preflight.sh`

Reason: the user has explicitly said no AWS deployment until they can pay for the AWS plan and approve the deploy.

### Environment Files

- `apps/api/.env.development`
- `apps/api/.env.example`
- `apps/web/.env.example`

Reason: env changes can leak local assumptions, Cognito/AWS wiring, or secret-name drift. Review key names only, never values.

### Local Runtime And Broad App Behavior

- `apps/api/start-dev.js`
- `apps/web/public/sw.js`
- `README.md`
- `web-td.json`

Reason: these affect local startup, service-worker behavior, or project-wide instructions. Stage only after a focused review.

### Generated Prisma Client

- `libs/db/src/generated/client/**`

Reason: generated files are currently very noisy and include engine/client churn. Do not stage unless repo policy requires generated client to be committed for this push.

## Never-Stage Paths

Do not stage these for the care-spine or production-readiness push.

- `.playwright-mcp/**`
- `_reports/**`
- `artifacts/**`
- `output/**`
- `apps/api/test-results/junit.xml`
- `libs/db/demo/output/seed-summary.json`
- `oasis-dashboard-local.png`
- `security_best_practices_report.md`
- `tools/session-manager-plugin/**`

Reason: these are local screenshots, QA traces, generated reports, diagnostics, or tool payloads. They will pollute the branch and make review harder.

## Current Known Staging Risk

The current worktree has a large tracked diff plus many untracked product files. The biggest risk is not the product direction; it is committing the wrong set.

Use `git diff --stat` and `git status --short --untracked-files=all` before every staging pass. If a file is not covered by this document, default to `hold-review`.

Current isolation report:

- `docs/strategy/OASIS_CLEAN_PUSH_ISOLATION_2026-05-11.md`

Use it for exact packet commands and the latest dirty-worktree counts before staging.

## Safe Staging Pattern

Use explicit paths, not `git add .`.

Good:

```bash
git add docs/strategy/OASIS_ACTIVE_HANDOFF.md
git add docs/strategy/OASIS_CLEAN_PUSH_FILESET.md
git add docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md
git add docs/superpowers/plans/2026-05-11-production-readiness-hardening.md
```

Risky:

```bash
git add .
git add apps
git add docs
```

## Before Any Ready-To-Push Claim

- Run `git status --short --untracked-files=all`.
- Run `git diff --stat`.
- Confirm no `never-stage` files are staged.
- Confirm no env file is staged unless explicitly approved.
- Confirm no deployment workflow is staged unless explicitly approved.
- Confirm no generated Prisma client file is staged unless repo policy is confirmed.
- Run `pnpm --dir libs/db exec prisma validate`.
- Run targeted API tests relevant to changed modules.
- Run `pnpm --filter @oasis/web build`.
- Browser-test `/login`, `/today`, `/people`, `/schedule`, visit detail, `/medication`, `/family-updates`, `/care-planning`, `/evidence`, and `/settings`.
