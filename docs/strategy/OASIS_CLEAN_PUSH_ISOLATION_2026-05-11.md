# Oasis Clean Push Isolation - 2026-05-11

This report turns the current dirty worktree into a safe staging plan. It does not stage, commit, push, deploy, run Terraform, or mutate AWS.

## Current Branch

```txt
feat/staging-live-setup
```

Keep working here unless the user explicitly says otherwise.

## Current Inventory

Latest classification from `git status --porcelain=v1 --untracked-files=all`:

| Group | Count | Push posture |
| --- | ---: | --- |
| Product candidates | 234 | Stage only in the product/care-spine packet after review. |
| Strategy doc candidates | 16 | Stage with the anti-drift/product-plan packet. |
| Production-readiness candidates | 12 | Stage only in a separate readiness packet. |
| Deployment/infra hold-review | 5 | Do not stage without explicit deployment-scope approval. |
| Environment hold-review | 3 | Do not stage unless key names only are reviewed; never expose values. |
| Local runtime hold-review | 4 | Review separately because these affect local startup/PWA/project docs. |
| Generated Prisma hold-review | 7 | Do not stage unless repo policy explicitly requires generated client output. |
| Never-stage noise | 1429 | Do not stage. These are reports, screenshots, artifacts, traces, and tool payloads. |

No files were staged during this isolation pass.

## Recommended Commit Packets

### Packet 1: Product Care Spine

Purpose: coherent app/product work for Today, People, Schedule, Visit Workflow, Medication Round, CareBridge, care planning, evidence, auth/access, API services, tests, schema, migrations, and seed data.

Candidate command:

```bash
git add -- \
  apps/api/src \
  apps/api/test \
  apps/web/app \
  apps/web/components \
  apps/web/lib \
  apps/web/middleware.ts \
  apps/web/next.config.js \
  apps/web/package.json \
  libs/auth/package.json \
  libs/auth/src \
  libs/db/prisma/schema.prisma \
  libs/db/prisma/migrations \
  libs/db/prisma/seed.ts \
  pnpm-lock.yaml
```

Pre-commit verification for this packet:

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/api build
pnpm --filter @oasis/web build
```

Browser QA before marking ready:

```txt
/login
/today
/people
/schedule
visit detail route
/medication
/family-updates
/care-planning
/evidence
/settings
family login redirects staff routes back to /family
```

### Packet 2: Strategy And Handoff

Purpose: keep the frontier-care platform direction, anti-drift rules, branch rules, and session resume instructions with the product work.

Candidate command:

```bash
git add -- \
  docs/strategy \
  docs/superpowers/plans
```

Review note: `docs/strategy` includes several broader product/competitive strategy files. That is intentional only if this push is meant to preserve the planning context, not just code.

### Packet 3: No-Deploy Production Readiness

Purpose: production-readiness docs and parameterised scripts only. This is deployment-adjacent but does not deploy.

Candidate command:

```bash
git add -- \
  ENV-Matrix.md \
  docs/gdpr \
  docs/BUYER_ACCEPTANCE_EVIDENCE.md \
  docs/DEPLOY_CHECKLIST.md \
  docs/OBSERVABILITY_SLOS.md \
  docs/PRODUCTION_RELEASE_RUNBOOK.md \
  docs/RELIABILITY_GATES.md \
  docs/SUPPORT_HANDOFF.md \
  scripts/release/check-secrets-parity.sh \
  scripts/release/production-readiness-scripts.test.mjs \
  infrastructure/scripts/run-migration.sh \
  infrastructure/scripts/smoke-test.sh
```

Pre-commit verification for this packet:

```bash
node --test scripts/release/production-readiness-scripts.test.mjs
bash -n scripts/release/check-secrets-parity.sh
bash -n infrastructure/scripts/run-migration.sh
bash -n infrastructure/scripts/smoke-test.sh
```

Do not run deployment scripts except in dry-run mode until deployment is approved.

## Hold-Review Files

Do not stage these in the next clean push unless the user explicitly approves the scope.

### Deployment / Infrastructure

```txt
.github/workflows/deploy-production.yml
.dockerignore
apps/api/Dockerfile
apps/api/docker-entrypoint.sh
apps/web/Dockerfile
scripts/release/preflight.sh
```

Reason: the user has not approved AWS deployment yet.

### Environment Files

```txt
apps/api/.env.development
apps/api/.env.example
apps/web/.env.example
```

Reason: env files can leak local assumptions or secret wiring. Review key names only.

### Local Runtime / Broad Behaviour

```txt
README.md
apps/api/start-dev.js
apps/web/public/sw.js
web-td.json
```

Reason: these change local startup, project instructions, or PWA/service-worker behaviour and should be reviewed separately.

### Generated Prisma Client

```txt
libs/db/src/generated/client/**
```

Reason: generated client and engine churn is huge and should not be included unless the repo policy requires committing generated Prisma output.

## Never-Stage Paths

These should remain out of the push:

```txt
.playwright-mcp/**
_reports/**
artifacts/**
output/**
apps/api/test-results/junit.xml
libs/db/demo/output/seed-summary.json
oasis-dashboard-local.png
security_best_practices_report.md
tools/session-manager-plugin/**
```

## Safety Checks After Any Staging

Run this after staging any packet:

```bash
git diff --cached --name-only | rg '^(apps/api/\\.env|apps/web/\\.env|libs/db/src/generated/client|_reports/|artifacts/|output/|\\.playwright-mcp/|\\.github/workflows/deploy-production\\.yml|apps/api/test-results/junit\\.xml|oasis-dashboard-local\\.png|security_best_practices_report\\.md|tools/session-manager-plugin/)'
```

Expected result: no output.

Then inspect staged stats:

```bash
git diff --cached --stat
git diff --cached --name-status
```

If a staged file is not clearly part of the packet, unstage it deliberately rather than broad-resetting the whole index.

## Exact Next Step

When the user says to stage:

1. Stage Packet 2 first if the goal is to preserve context.
2. Stage Packet 1 next if the goal is a product push.
3. Stage Packet 3 only if the user wants production-readiness changes included.
4. Run the packet-specific verification gates.
5. Do not stage hold-review or never-stage paths.

If the user says to commit, create separate commits by packet instead of one giant mixed commit.
