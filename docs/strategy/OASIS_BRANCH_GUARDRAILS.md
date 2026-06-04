# Oasis Branch Guardrails

## Current Branch Strategy

Default working branch:

```txt
feat/staging-live-setup
```

This branch is the active local product branch for the next Care Spine push.

Do not switch branches, merge branches, deploy, or clean the worktree destructively unless the user explicitly asks for it.

## Branch Radar

Known branch roles as of 2026-05-06:

| Branch | Role | Action |
| --- | --- | --- |
| `feat/staging-live-setup` | Active working branch | Continue here. |
| `origin/main` | Main branch with merge commits from staging setup | Do not merge to main until explicit push/PR approval. |
| `codex/repo-cleanup-20260321` | Important reference branch with visit and medication work | Reference only; do not wholesale merge. |
| `codex/staging-clean-20260313` | RBAC and medication harness cleanup | Reference later if auth/medication tests need it. |
| `hotfix-staging-prisma-runtime` | Prisma runtime target hotfix for staging | Keep for AWS later, not local product work now. |
| `feature/ai-summary-foundations` | Older AI work behind current branch | Ignore for this push. |

## No-Merge Rule

Do not wholesale merge `codex/repo-cleanup-20260321`.

Reason:

- It contains useful visit and medication work.
- It also touches infra, auth, staging, medication, visits, generated files, and broad app surfaces.
- A wholesale merge would create conflict risk and product drift.

Allowed use:

- Compare relevant paths before editing visit or medication files.
- Borrow concepts manually if they fit the active slice.
- Cherry-pick only after a separate review and explicit approval.

## Required Branch Check

At the start of every coding session:

```bash
git branch --show-current
git status --short
```

If the branch is not `feat/staging-live-setup`, stop and confirm the intended branch.

If the worktree is dirty, identify whether dirty files are:

- intentional product changes,
- generated files,
- local env/config noise,
- reports/output/artifacts,
- unrelated user edits.

Do not revert user edits.

## Reference-Branch Comparison

Before touching visit or medication files, run a targeted diff against the reference branch.

Visit paths:

```bash
git diff --name-status feat/staging-live-setup..codex/repo-cleanup-20260321 -- apps/api/src/visit apps/web/app/visits apps/web/app/schedule
```

Medication paths:

```bash
git diff --name-status feat/staging-live-setup..codex/repo-cleanup-20260321 -- apps/api/src/medication apps/web/app/medication apps/web/app/emar
```

CareBridge paths:

```bash
git diff --name-status feat/staging-live-setup..codex/repo-cleanup-20260321 -- apps/api/src/carebridge apps/web/app/carebridge apps/web/app/family-updates apps/web/app/family
```

Use the comparison to avoid duplicating solved work, not to trigger a merge.

## Files To Avoid Staging Accidentally

Review carefully before staging:

- `.env*`
- `apps/api/.env*`
- `apps/web/.env*`
- `_reports/`
- `_generated/`
- `artifacts/`
- `output/`
- `.playwright-mcp/`
- screenshots such as `*.png` unless intentionally part of docs.
- generated Prisma client binaries unless the active slice explicitly requires them.
- AWS, Terraform, workflow, or deployment files unless the active slice explicitly requires them.

## AWS And Deployment Guardrail

No AWS deployment until the user explicitly approves.

Do not:

- push to `main`;
- create tags;
- run AWS deploy scripts;
- run Terraform apply;
- trigger staging or production deployment workflows;
- modify deployment infrastructure as part of product feature work.

Deployment-readiness docs and non-deploy checks are allowed only if they do not deploy or mutate cloud resources.

## Commit And Push Hygiene

Before any commit:

```bash
git status --short
git diff --stat
```

Stage only intentional files. Prefer explicit paths over broad staging:

```bash
git add path/to/file-1 path/to/file-2
```

Before any push:

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/web build
git status --short
```

If verification is too slow or blocked, report the blocker instead of claiming readiness.

