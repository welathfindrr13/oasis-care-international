# Oasis Session Start Checklist

Use this checklist every time the user says "go", "continue", "carry on", "push", or asks to build the next Oasis slice.

## 1. Read The Source Of Truth

Read these first:

```bash
sed -n '1,220p' docs/strategy/OASIS_PLATFORM_NORTH_STAR.md
sed -n '1,260p' docs/strategy/OASIS_ACTIVE_HANDOFF.md
sed -n '1,240p' docs/strategy/OASIS_EXECUTION_RAIL.md
sed -n '1,240p' docs/strategy/OASIS_BRANCH_GUARDRAILS.md
sed -n '1,220p' docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md
sed -n '1,260p' docs/superpowers/plans/2026-05-11-production-readiness-hardening.md
sed -n '1,220p' docs/superpowers/plans/2026-05-06-care-spine-push.md
```

## 2. Confirm Branch And Worktree

Run:

```bash
git branch --show-current
git status --short
```

Expected branch:

```txt
feat/staging-live-setup
```

If dirty files exist, do not clean or revert them automatically. Work around unrelated dirty files and stage only intentional changes.

## 3. Confirm Local App Health

Check local services:

```bash
curl -fsS http://localhost:4000/health
curl -fsS -I http://localhost:3002/login
```

Expected:

- API health responds successfully.
- Web login route responds successfully.

If services are down, restart local dev without deploying to AWS.

## 4. Check Reference Branch Before Overlap Work

Before editing visit or medication files, compare against `codex/repo-cleanup-20260321`.

```bash
git diff --name-status feat/staging-live-setup..codex/repo-cleanup-20260321 -- apps/api/src/visit apps/web/app/visits apps/web/app/schedule
git diff --name-status feat/staging-live-setup..codex/repo-cleanup-20260321 -- apps/api/src/medication apps/web/app/medication apps/web/app/emar
```

Use the branch as a reference. Do not merge it wholesale.

## 5. Pick The Next Slice

Use this priority order:

1. Fix local reliability or broken core routes.
2. If the user says "production hardening", follow `docs/superpowers/plans/2026-05-11-production-readiness-hardening.md`.
3. Prepare clean push with intentional files only.
4. Finish Today, People, Schedule, Medication, Family Updates coherence.
5. Build or refine Assessments, Care Plans, and Evidence only within the current rail.
6. Wire command-centre signals.
7. Browser-test and prepare a clean push.

If the user asks for something outside this order, do it only after confirming it does not conflict with the north star or branch guardrails.

## 6. Subagent Rules

Use Codex 5.3 subagents when the task has independent workstreams.

Default subagent boxes:

- Backend worker: API, Prisma schema/migrations, services, resolvers, backend tests.
- Frontend worker: routes, components, query wiring, UX states, web build issues.
- QA worker: browser walkthrough, access checks, regression checklist, release-risk notes.

Subagents must not edit:

- AWS deployment files.
- Terraform.
- GitHub deployment workflows.
- Generated Prisma client files.
- Local env files.
- Reports or artifacts.
- Unrelated auth foundations.

Main agent must review subagent diffs and run verification before claiming completion.

## 7. Required User-Facing Feedback Loop

Keep updates short but frequent:

- Say what slice is being worked.
- Say what context was found.
- Say what edits are about to happen before editing.
- Say what verification is running.
- Say exactly what failed if anything fails.

Do not claim work is complete without fresh verification output.

## 8. Final Verification Before Ready

Run the strongest feasible checks:

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
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

Access QA:

- family cannot access staff routes.
- family cannot access raw operational records.
- revoked family access is enforced on next query.

## 9. Push Safety

Before staging:

```bash
git status --short
git diff --stat
```

Only stage intentional product files. Do not include local reports, generated output, screenshots, env files, AWS deployment files, or unrelated branch leftovers.
