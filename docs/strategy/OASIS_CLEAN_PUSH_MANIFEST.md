# Oasis Clean Push Manifest

This manifest protects `feat/staging-live-setup` from accidental noise, generated files, local-only changes, and deployment drift. Read it before staging anything for Care Spine Push 1.

For the current dirty-worktree classification, also read `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`.

## Branch Rule

Use `feat/staging-live-setup` unless the user explicitly says otherwise.

Do not deploy to AWS from this branch. Do not stage or push deployment automation unless the user explicitly approves deployment work.

## Stage Now Candidates

These paths are likely intentional for Care Spine Push 1, but still review diffs before staging:

- `apps/api/src/**`
- `apps/api/test/**`
- `apps/web/app/**`
- `apps/web/components/**`
- `apps/web/lib/**`
- `libs/auth/src/**`
- `libs/auth/package.json`
- `libs/db/prisma/schema.prisma`
- `libs/db/prisma/migrations/**`
- `libs/db/prisma/seed.ts`
- `apps/web/package.json`
- `pnpm-lock.yaml`
- `docs/strategy/**`
- `docs/superpowers/**`
- `docs/BUYER_ACCEPTANCE_EVIDENCE.md`
- `docs/OBSERVABILITY_SLOS.md`
- `docs/RELIABILITY_GATES.md`
- `docs/SUPPORT_HANDOFF.md`

## Hold For Explicit Review

Do not stage these just because they are changed:

- `.github/workflows/deploy-production.yml`
- `.dockerignore`
- `apps/api/Dockerfile`
- `apps/api/docker-entrypoint.sh`
- `apps/web/Dockerfile`
- `scripts/release/preflight.sh`
- `README.md`
- `apps/api/start-dev.js`
- `apps/api/.env.development`
- `apps/api/.env.example`
- `apps/web/.env.example`
- `apps/web/public/sw.js`
- `web-td.json`

Reason: these are infra, deployment, local setup, generated, or broad operational files. Some may be intentional later, but they need a separate review pass because the current user instruction is local-only and no AWS deployment.

## Do Not Stage Noise

Never stage these for the Care Spine push:

- `.playwright-mcp/**`
- `_reports/**`
- `artifacts/**`
- `output/**`
- `apps/api/test-results/junit.xml`
- `libs/db/demo/output/seed-summary.json`
- `oasis-dashboard-local.png`
- `security_best_practices_report.md`
- `tools/session-manager-plugin/**`

## Prisma Generated Client

Do not stage generated Prisma client files unless the repo policy is explicitly confirmed for this push:

- `libs/db/src/generated/client/**`

The source of truth is `libs/db/prisma/schema.prisma` plus migrations. Generated engines and client files create large churn and can hide real product diffs.

## Clean Push Checklist

Before claiming the branch is ready:

- Run `git status --short`.
- Run `git diff --stat`.
- Review each staged path against this manifest.
- Exclude AWS/deployment files unless explicitly approved.
- Exclude env files unless explicitly approved.
- Exclude generated files and local artifacts.
- Run the verification gates in `docs/strategy/OASIS_EXECUTION_RAIL.md`.
- Report any known product gaps honestly, especially evidence source picker scope.
