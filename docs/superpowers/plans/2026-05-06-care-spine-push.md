# Care Spine Push 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Oasis coherent locally, then add the missing assessment, care-plan, and evidence spine without redoing visit or medication work blindly.

**Architecture:** Keep operational records authoritative and build planning/evidence as governed layers over existing people, visits, care notes, medication, and CareBridge records. Use the current `feat/staging-live-setup` branch, treat `codex/repo-cleanup-20260321` as reference only, and keep AWS/deployment work out of this push.

**Tech Stack:** Next.js App Router, NestJS GraphQL, Prisma/PostgreSQL, NextAuth/local dev auth, TypeScript, Jest, pnpm, in-app browser QA.

---

## Source Of Truth

Read before implementing:

- `docs/strategy/OASIS_PLATFORM_NORTH_STAR.md`
- `docs/strategy/OASIS_EXECUTION_RAIL.md`
- `docs/strategy/OASIS_BRANCH_GUARDRAILS.md`
- `docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md`
- `docs/strategy/OASIS_SESSION_START.md`

## Scope

Included:

- local app reliability checks.
- UX coherence across Today, People, Schedule, Medication, Family Updates.
- Assessments MVP.
- Care Plans MVP.
- Evidence MVP.
- command-centre signals from the care spine.
- browser QA and clean push preparation.

Excluded:

- AWS deployment.
- marketplace or referral flows.
- DSCR or GP Connect claims.
- payroll or advanced rostering.
- broad infra/auth rewrites.
- wholesale merge from `codex/repo-cleanup-20260321`.
- raw family access to operational records.

## Task 1: Session Guard And Baseline Verification

**Files:**

- Read: `docs/strategy/OASIS_SESSION_START.md`
- Read: `docs/strategy/OASIS_BRANCH_GUARDRAILS.md`

- [x] Run `git branch --show-current`.
- [x] Confirm branch is `feat/staging-live-setup`.
- [x] Run `git status --short`.
- [x] Identify dirty files that are unrelated to the active slice.
- [x] Confirm local API health with `curl -fsS http://localhost:4000/health`.
- [x] Confirm web login route with browser/curl `GET http://localhost:3002/login`.
- [x] If local services are down or stale, restart local dev only. Do not deploy to AWS.

**Done when:** the session has a known branch, known dirty state, and local health status.

## Task 2: Existing UX Coherence Pass

**Files:**

- Inspect: `apps/web/app/today`
- Inspect: `apps/web/app/people`
- Inspect: `apps/web/app/schedule`
- Inspect: `apps/web/app/medication`
- Inspect: `apps/web/app/family-updates`
- Inspect: `apps/web/components/oasis`

- [x] Browser-test `/login`, `/today`, `/people`, `/schedule`, `/medication`, `/family-updates`, `/settings`.
- [x] Fix only broken or confusing route/link/copy issues that block the care-spine flow.
- [x] Keep product language aligned: Today, People, Schedule, Care Notes, Medication Round, Family Updates.
- [x] Do not redesign unrelated pages.
- [x] Run `pnpm --filter @oasis/web build` after changes.

**Done when:** the existing app feels coherent enough to build care planning and evidence on top.

## Task 3: Reference-Branch Check For Visit And Medication Overlap

**Files:**

- Compare: `apps/api/src/visit`
- Compare: `apps/web/app/visits`
- Compare: `apps/web/app/schedule`
- Compare: `apps/api/src/medication`
- Compare: `apps/web/app/medication`
- Compare: `apps/web/app/emar`

- [ ] Run the targeted diffs from `OASIS_BRANCH_GUARDRAILS.md`.
- [ ] Note useful visit or medication ideas from `codex/repo-cleanup-20260321`.
- [ ] Do not merge the reference branch.
- [ ] Avoid visit and medication rewrites unless the active task requires them.

**Done when:** workers know what not to duplicate.

## Task 4: Assessments MVP

**Backend files:**

- Modify or extend: `apps/api/src/care-planning`
- Modify or extend: `libs/db/prisma/schema.prisma` only if required by current persistence gaps.
- Test: relevant care-planning API tests.

**Frontend files:**

- Modify or extend: `apps/web/app/care-planning`
- Modify or extend: person-profile care-planning surfaces.
- Modify or extend: `apps/web/lib/graphql/queries.ts` if GraphQL wiring is needed.

- [x] Confirm existing care-planning schema and resolver shape.
- [x] Add or complete assessment list, detail, and create flow.
- [x] Ensure assessment records are organisation-scoped and person-scoped.
- [x] Ensure completed assessment records show who completed them and when.
- [x] Show assessments from the person profile.
- [x] Add empty states explaining how assessments feed care plans.
- [x] Add backend tests for create/list/get access and tenant scoping.
- [x] Add web build verification.

**Done when:** staff can create and view assessments from care planning and person context.

## Task 5: Care Plans MVP

**Backend files:**

- Modify or extend: `apps/api/src/care-planning`
- Modify or extend: `libs/db/prisma/schema.prisma` only if required by current persistence gaps.
- Test: relevant care-plan service/resolver tests.

**Frontend files:**

- Modify or extend: `apps/web/app/care-planning`
- Modify or extend: person-profile care-plan tab/surface.

- [x] Confirm existing care-plan model, status, version, approval, and review capabilities.
- [x] Add or complete care-plan list, detail, create/draft, approval, active version, and review due UI.
- [x] Make draft versus active state visually unambiguous.
- [x] Preserve old active versions when a new one is approved.
- [x] Show care-plan review due state on person profile.
- [x] Add command-centre lane or count for care-plan review due if backend data supports it.
- [x] Add backend tests for draft, approval, active version, and review due behavior.
- [x] Run web build and relevant API tests.

**Done when:** care plans can act as the governance spine for visits, notes, family updates, and evidence.

## Task 6: Evidence MVP

**Backend files:**

- Modify or extend: `apps/api/src/care-planning` or create bounded `apps/api/src/evidence` only if current care-planning evidence code is insufficient.
- Test: evidence pack service/resolver tests.

**Frontend files:**

- Modify or extend: `apps/web/app/evidence`
- Modify or extend: `apps/web/app/reports` if it aliases evidence.

- [x] Confirm existing EvidencePack and EvidenceItem persistence.
- [x] Add or complete evidence-pack list, detail, create, source display, and care-planning source selection flow.
- [x] Allow API-created packs to include currently supported allowed record types: assessments, care plans, visits, care notes, medication administrations, concern cases, and manual notes.
- [x] Include selected care plans, selected assessments, and care-plan-linked assessments as source items from the current care-planning UI.
- [ ] Add a staff source picker for visits, care notes, medication administrations/exceptions, concern cases, family updates, approvals, and audit events where currently available.
- [ ] Add source enum/model support for family updates, approval decisions, and audit events if they become first-class evidence inputs.
- [x] Add export generation only if the current code can produce a real file safely; otherwise keep export clearly blocked and do not label it complete.
- [x] Use "inspection-ready evidence" wording, not compliance guarantees.
- [x] Ensure family-restricted data is not exposed in family-facing surfaces.
- [x] Add tests for evidence-pack creation and allowed item scoping.

Known hardening now covered:

- [x] Add backend audit-log recording for evidence-pack PDF downloads.

**Done when:** managers can build an evidence pack from allowed source records and understand its inspection-review purpose.

## Task 7: Command-Centre Signals

**Files:**

- Modify or extend: Today/dashboard backend aggregation.
- Modify or extend: `apps/web/app/today` or dashboard route.
- Modify or extend: query files used by Today.

- [x] Add actionable signals for care-plan review due, assessments needing completion, evidence gaps, and family-review backlog where data exists.
- [x] Back Missing Care Notes and Medication Exceptions lanes with existing care-log and medication data instead of placeholder counts.
- [x] Keep each card action-oriented with a route target.
- [x] Avoid vanity stats that do not lead to work.
- [x] Make failed data fetches degrade gracefully.

**Done when:** Today tells a manager what needs attention next.

## Task 8: CareBridge And Family Access Regression

**Files:**

- Inspect and test: `apps/api/src/carebridge`
- Inspect and test: `apps/web/app/family`
- Inspect and test: `apps/web/app/family-updates`
- Inspect and test: `apps/web/middleware.ts`

- [x] Verify draft and rejected family updates are invisible to family users through published-only feed queries.
- [x] Verify approved updates are visible only to scoped family users through active membership and `VIEW_UPDATES` grant checks.
- [x] Verify family users cannot access raw visits, medications, and care-planning GraphQL data.
- [x] Verify family users cannot access raw care logs, medication administrations, medication lists, due medication rows, monthly care summaries, staff data, and care-planning data.
- [ ] Add future-proof coverage for medication audit rows if a read resolver is introduced.
- [x] Verify revoked family access blocks the next query through non-revoked grant filtering.
- [x] Verify medication visibility remains status-only by default and when medication support visibility is enabled.

**Done when:** CareBridge stays a governed projection layer.

## Task 9: Full Verification And Browser QA

**Commands:**

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/web build
```

**Browser routes:**

- `/login`
- `/today`
- `/people`
- `/people/[id]`
- `/schedule`
- visit detail route
- `/medication`
- `/family-updates`
- `/care-planning`
- `/evidence`
- `/settings`

- [x] Run the commands above.
- [x] Browser-test the listed routes from a user point of view.
- [x] Record any known gaps honestly.
- [x] Do not claim readiness if verification fails.

**Done when:** verification evidence supports the push.

## Task 10: Clean Push Preparation

**Commands:**

```bash
git status --short
git diff --stat
```

- [ ] Review dirty files.
- [ ] Stage only intentional source, docs, test, and migration files.
- [ ] Exclude env files, generated output, reports, screenshots, artifacts, AWS deployment files, and unrelated work.
- [ ] Do not push to `main`.
- [ ] Do not deploy to AWS.
- [ ] Prepare a concise change summary and verification summary.

**Done when:** the branch is ready for an intentional commit or PR path, with no accidental deploy risk.

## Subagent Execution Model

Use Codex 5.3 subagents after Task 1 when work can split cleanly:

- Backend worker: Tasks 4, 5, 6 backend and tests.
- Frontend worker: Tasks 2, 4, 5, 6, 7 frontend.
- QA worker: Tasks 8 and 9.
- Main agent: branch guardrails, integration, conflict resolution, final verification, and git hygiene.

Subagents must not edit infra, deployment, generated Prisma client, env files, reports, artifacts, or unrelated auth foundations.

## Acceptance Criteria

Care Spine Push 1 is acceptable when:

- Existing local product routes remain usable.
- Assessments, care plans, and evidence have real staff-facing workflows.
- Today surfaces care-spine work.
- Family access remains safe and projection-only.
- Tests/builds pass or failures are clearly reported.
- No AWS deployment occurs.
- Only intentional files are staged for push.
