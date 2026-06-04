# Oasis Active Handoff

Use this file when a session is resumed after rate limits, app restart, or a cold start. It is intentionally blunt and operational: read it before deciding what to do next.

## Resume Command

If the user says only:

```txt
continue production hardening
```

then do this:

1. Confirm branch and dirty state.
2. Read the source-of-truth files listed below.
3. Do not ask the user to restate the product plan.
4. Continue from the current next slice.

## Source Of Truth To Read First

```bash
git branch --show-current
git status --short
sed -n '1,260p' docs/strategy/OASIS_ACTIVE_HANDOFF.md
sed -n '1,260p' docs/strategy/OASIS_PLATFORM_NORTH_STAR.md
sed -n '1,260p' docs/strategy/OASIS_EXECUTION_RAIL.md
sed -n '1,240p' docs/strategy/OASIS_BRANCH_GUARDRAILS.md
sed -n '1,240p' docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md
sed -n '1,260p' docs/strategy/OASIS_CLEAN_PUSH_FILESET.md
sed -n '1,320p' docs/strategy/OASIS_CLEAN_PUSH_ISOLATION_2026-05-11.md
sed -n '1,340p' docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md
sed -n '1,260p' docs/strategy/OASIS_NO_DEPLOY_READINESS_REPORT.md
sed -n '1,260p' docs/superpowers/plans/2026-05-11-production-readiness-hardening.md
sed -n '1,280p' docs/superpowers/plans/2026-05-06-care-spine-push.md
```

## Current Date Snapshot

Updated: 2026-05-11.

Active branch:

```txt
feat/staging-live-setup
```

Current local health at the time this handoff was written:

- API `http://localhost:4000/health` returned `{"status":"ok","version":"unknown","commitSha":"unknown","environment":"development"}`.
- Web `http://localhost:3002/login` returned `HTTP/1.1 200 OK`.
- Local web/API were restarted cleanly after a stale `.next` dev artifact caused the login button to stay on `/login`.

Do not assume these are still true tomorrow. Recheck them first.

## User Goal

Oasis should become a proof-led domiciliary/private care operating system:

```txt
Assess need
→ approve care plan
→ schedule care visit
→ guide care actions
→ record care once
→ flag exceptions
→ draft family-safe update
→ resolve concerns
→ preserve evidence
→ improve care governance
```

CareBridge is the trust layer, not the whole product. The platform spine is care planning, care delivery, medication safety, evidence, and management clarity.

## Current Strategic Priority

The user asked for production readiness hardening after clarifying:

- AWS secrets/config mostly exist already.
- No AWS deployment should happen until explicitly approved and affordable.
- Compliance focus is UK GDPR because the user is UK-based.

So the next sprint is:

```txt
Production Readiness Hardening Sprint
```

Not:

- new marketplace work,
- DSCR/GP Connect,
- payroll,
- advanced rostering,
- AWS deployment,
- broad redesign,
- competitor cloning.

## Current Next Slice

The no-deploy production-readiness review has been completed and written down.

Next clean slice:

```txt
Clean Push Staging:
when the user explicitly says to stage/commit, use OASIS_CLEAN_PUSH_ISOLATION_2026-05-11.md to stage packeted changes without env/generated/artifact/deploy noise.
```

After that:

1. Wire parameterised migration/smoke scripts into production release procedure when deployment work is explicitly approved.
2. Add strict role/access smoke probes to release procedure.
3. Create production secret names only when deployment is approved.
4. Do not stage env, generated Prisma client, reports, artifacts, or deployment workflow files unless explicitly approved.

## Production Readiness Findings So Far

Already present in the repo:

- Staging deploy workflow: `.github/workflows/docker-ecr.yml`.
- Production signed-tag workflow exists as an untracked file: `.github/workflows/deploy-production.yml`.
- Secrets parity checker: `scripts/release/check-secrets-parity.sh`.
- ECS Secrets Manager wiring: `infrastructure/staging/secrets.tf`.
- Migration runner: `infrastructure/scripts/run-migration.sh`.
- Smoke test script: `infrastructure/scripts/smoke-test.sh`.
- Release runbook and SLO docs: `docs/PRODUCTION_RELEASE_RUNBOOK.md`, `docs/RELIABILITY_GATES.md`, `docs/OBSERVABILITY_SLOS.md`.
- GDPR module/docs: `apps/api/src/gdpr`, `docs/gdpr/TECH_CHECKLIST.md`.
- Clean push fileset: `docs/strategy/OASIS_CLEAN_PUSH_FILESET.md`.
- Clean push isolation report: `docs/strategy/OASIS_CLEAN_PUSH_ISOLATION_2026-05-11.md`.
- Production gaps report: `docs/strategy/OASIS_PRODUCTION_READINESS_GAPS.md`.
- No-deploy readiness report: `docs/strategy/OASIS_NO_DEPLOY_READINESS_REPORT.md`.

Important caveats:

- Do not print secret values.
- Do not stage `.github/workflows/deploy-production.yml` without explicit approval.
- Do not stage generated Prisma client files by default.
- Do not stage `_reports`, `artifacts`, `output`, `.playwright-mcp`, screenshots, or local diagnostics.
- `apps/api/.env.development` is modified and must be reviewed before staging.
- `libs/db/src/generated/client/**` has generated churn and should not be staged unless repo policy is explicitly confirmed.

## Production Readiness Gaps

Treat these as the current hardening backlog:

- The dirty worktree is too noisy for a safe push without the clean fileset.
- GDPR endpoints are feature-flagged and now controller-guarded for `admin`/`manager`, but service-level/legal hardening is still needed before production.
- GDPR SAR/erasure flows need end-to-end tests and operational procedure, not just controller endpoints.
- UK GDPR documentation needs DPIA, privacy notice checklist, controller/processor position, retention policy, SAR/erasure procedure, family-access authority rules, and medication visibility policy.
- Reliability soak workflow currently contains demo-looking credentials in workflow env; move to GitHub secrets.
- Staging RDS settings are not production-grade: `deletion_protection=false`, `skip_final_snapshot=true`, `multi_az=false`.
- CloudWatch alert subscription uses a placeholder destination.
- Production secret parity was checked by name only and currently fails for the expected production names.
- Secret parity checker now includes `JWT_SECRET`.
- Migration/smoke scripts now support production-safe parameters and dry-run plans, but are not wired into a production workflow yet.
- Production workflow needs post-deploy digest verification and smoke checks before use.
- Evidence source picker currently supports care plans and assessments in the UI. Wider source picking for visits, care notes, medication administrations/exceptions, concern cases, family updates, approvals, and audit events remains a later source-picker slice.

## Current Verification Facts

Recently verified before this handoff:

- API health returned `{"status":"ok","version":"unknown","commitSha":"unknown","environment":"development"}`.
- Web login route returned `HTTP/1.1 200 OK`.
- Staging secret names passed the name-only checker, including `JWT_SECRET`.
- Production secret names failed the name-only checker for the currently expected five names.
- `node --test scripts/release/production-readiness-scripts.test.mjs` passed.
- `bash -n` passed for `scripts/release/check-secrets-parity.sh`, `infrastructure/scripts/run-migration.sh`, and `infrastructure/scripts/smoke-test.sh`.
- Targeted API hardening tests passed: 8 suites, 40 tests.
- `pnpm --dir libs/db exec prisma validate` passed.
- `pnpm --filter @oasis/api build` passed.
- `pnpm --filter @oasis/web build` passed after the care-planning evidence picker change.
- `pnpm --filter @oasis/api test` passed: 26 suites, 173 tests.
- Browser QA in the in-app browser passed after clean local restart:
  - `/login` styled local auth rendered and `Continue` as admin reached `/today`.
  - `/today`, `/people`, `/schedule`, `/medication`, `/family-updates`, `/care-planning`, `/evidence`, and `/settings` loaded without runtime errors.
  - visit detail `/schedule/d83ce546-2de7-4507-af97-523327884d25` loaded the `Care Visit` workflow after client-side data fetch completed.
  - local family login landed on `/family`.
  - family attempts to open `/today` and `/schedule` redirected to `/family`.
  - family shell did not expose staff navigation.
- API health and web login route responded locally.
- In-app browser confirmed `/care-planning` loads seeded people and shows:
  - linked care plan selector,
  - include care-plan versions picker,
  - include assessments picker,
  - honest copy that visits/care notes/medication exceptions/concerns will be added once list queries are wired.
- Clean Push Isolation was written with three candidate packets:
  - Product Care Spine,
  - Strategy And Handoff,
  - No-Deploy Production Readiness.
- No files were staged during Clean Push Isolation.

Do not claim full readiness from these facts. They only prove the recent frontend/doc slice.

## Default Agent Model

When using subagents, use Codex 5.3 as requested by the user.

Use bounded workers:

- Backend worker: API, Prisma schema/migrations, services, resolvers, backend tests.
- Frontend worker: routes, components, query wiring, UX states, web build issues.
- QA worker: browser walkthrough, access checks, regression checklist, release-risk notes.
- Main agent: product coherence, conflict resolution, final verification, and git hygiene.

Subagents must not edit:

- deployment workflows,
- Terraform,
- generated Prisma client,
- env files,
- reports/artifacts,
- unrelated auth foundations,

unless the active plan explicitly allows it.

## Commands To Run Before Any Readiness Claim

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/api build
pnpm --filter @oasis/web build
```

Then browser QA:

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

- family cannot access staff routes,
- family cannot access raw visits,
- family cannot access raw care logs,
- family cannot access raw medication administrations or audit rows,
- family cannot access staff/admin/reporting data,
- revoked family access blocks next query or refresh.

## What To Say If Asked "What Next?"

Recommended answer:

```txt
Next is Clean Push Staging: use OASIS_CLEAN_PUSH_ISOLATION_2026-05-11.md to stage packeted changes only after explicit approval, keeping env files, generated Prisma client, reports, artifacts, local screenshots, and hold-review deployment workflow files out.
```

Then continue from `docs/superpowers/plans/2026-05-11-production-readiness-hardening.md`.
