# Oasis Execution Rail

## Current Operating Rule

Every future implementation session must start here, then read:

- `docs/strategy/OASIS_PLATFORM_NORTH_STAR.md`
- `docs/strategy/OASIS_ACTIVE_HANDOFF.md`
- `docs/strategy/OASIS_BRANCH_GUARDRAILS.md`
- `docs/strategy/OASIS_CLEAN_PUSH_MANIFEST.md`
- `docs/strategy/OASIS_SESSION_START.md`
- `docs/superpowers/plans/2026-05-11-production-readiness-hardening.md`
- `docs/superpowers/plans/2026-05-06-care-spine-push.md`

The execution rail exists to prevent drift. If a requested change conflicts with this rail, pause and restate the tradeoff before coding.

## Active Branch

Use `feat/staging-live-setup` as the working branch unless the user explicitly tells us to switch.

Do not deploy to AWS from this branch until the user explicitly approves deployment.

## Active Product Push

Current push:

```txt
Care Spine Push 1
```

Goal:

```txt
Make the current product coherent, then add the missing assessment, care-plan, and evidence spine without redoing visit or medication work blindly.
```

## Roadmap Status

Status key:

- `CURRENT`: active implementation focus.
- `NEXT`: queued after current focus.
- `LATER`: deliberately delayed.
- `LOCKED`: do not start without explicit approval.

| Order | Slice | Status | Done Criteria |
| --- | --- | --- | --- |
| 1 | UX clarity and local reliability | CURRENT | Login, Today, People, Schedule, Medication, Family Updates, Settings render locally and are understandable. |
| 2 | Today Command Centre | CURRENT | Urgent work appears as actionable lanes, not decorative stats. |
| 3 | Person profile hub | CURRENT | Staff can understand a person's care status without opening five unrelated screens. |
| 4 | Visit workflow cleanup | CURRENT | Carer can start visit, record care actions, add care note, handle medication status, and complete visit once. |
| 5 | Medication round refinement | NEXT | Medication exceptions surface clearly and family visibility remains status-only. |
| 6 | Assessments MVP | CURRENT | Staff can complete organisation-scoped, person-scoped assessments and see them from the person profile. |
| 7 | Care Plans MVP | CURRENT | Staff can create, approve, version, and review care plans tied to assessment context. |
| 8 | CareBridge completion | NEXT | Family updates, concern cases, SLA state, and access revocation are complete and auditable. |
| 9 | Evidence and inspection MVP | CURRENT | Staff can build and export evidence packs from allowed records. |
| 10 | Body maps, staff training, policies, imports, billing | LATER | Only start after care spine and evidence are stable. |
| 11 | AWS deployment, DSCR, GP Connect, marketplace, payroll | LOCKED | Only start after explicit user approval. |

## Current Next Slice

Work in this order:

1. If continuing production readiness, follow `docs/superpowers/plans/2026-05-11-production-readiness-hardening.md`.
2. Prepare clean push with intentional files only.
3. Add a fuller evidence source picker for visits, care notes, medication administrations/exceptions, concern cases, family updates, approvals, and audit events where source models exist.
4. Continue CareBridge/family access regression coverage for medication-audit future-proofing if a read surface is introduced.

## Progress Snapshot

Updated: 8 May 2026.

Verified today:

- Local API `/health` responds on `localhost:4000`.
- Local web `/login` responds on `localhost:3002`.
- Dev-server static assets were restarted and now serve CSS/JS correctly.
- `/login`, `/today`, `/people`, `/schedule`, `/medication`, `/family-updates`, `/care-planning`, `/evidence`, and `/settings` load in the browser as admin.
- Staff browser flow can create an assessment, mark it complete, create a care-plan draft, approve/activate it, and create an evidence pack.
- `/evidence` shows the updated assessment, active care-plan, and evidence-pack state.
- Person profile shows embedded assessment, active care-plan, review due, and evidence-pack coverage.
- Evidence packs now have a real PDF export route at `/api/evidence-packs/[id]/export`.
- Admin export returns `application/pdf`, attachment headers, and `%PDF` bytes in browser/API QA.
- Family export requests return `403 Forbidden` without an HTML app-shell redirect.
- Successful evidence-pack PDF exports record an explicit `EVIDENCE_PACK_EXPORTED` backend audit event.
- Today Command Centre shows live care-spine signals for assessments needing completion, care-plan reviews due soon, and evidence gaps.
- Missing Care Notes and Medication Exceptions lanes on Today are backed by existing care-log and medication data instead of placeholder zeroes.
- Family local user is redirected back to `/family` when attempting staff routes.
- Family-session GraphQL probes for raw visits, medications, and care-planning assessments return `FORBIDDEN`.
- Family-session GraphQL probes for raw care logs, monthly care summaries, medication lists, medication administrations, due medications, carers/staff data, visits, and care-planning assessments return `FORBIDDEN`.
- Raw Care Notes service access now rejects `client` and family-style roles at the service layer, not only at resolver metadata.
- CareBridge feed tests now lock published-only family feed behavior, active membership checks, `VIEW_UPDATES` scope checks, and non-revoked grant filtering.
- Medication visibility tests now lock status-only CareBridge projection when medication visibility is enabled, with no names or doses in family update text.
- Evidence pack creation now supports real API source scoping for `VISIT`, `CARE_LOG`, `MEDICATION_ADMINISTRATION`, `ASSESSMENT`, `CARE_PLAN`, `CONCERN`, and `MANUAL_NOTE`.
- The care-planning UI includes selected care plans and linked assessments as evidence source items; wider staff item picking is still pending.
- `pnpm --dir libs/db exec prisma validate` passes.
- `pnpm --filter @oasis/api test` passes with 25 suites and 164 tests.
- `pnpm --filter @oasis/api build` passes.
- `pnpm --filter @oasis/web build` passes.

Still open:

- The evidence-pack UI does not yet let staff pick visits, care notes, medication administrations/exceptions, concern cases, family updates, approvals, or audit events.
- Family updates, approvals, and audit events are not evidence source enum values yet; add them deliberately rather than marking that checklist item complete by implication.
- Medication audit has no family-facing read resolver today; add a negative/future-proof test if one is introduced.
- Clean push preparation must isolate intentional files from the wider dirty worktree.

## Definition Of Done For Care Spine Push 1

Care Spine Push 1 is done only when:

- Local login works.
- `/today`, `/people`, `/schedule`, `/medication`, `/family-updates`, `/care-planning`, `/evidence`, `/settings` load.
- A manager can find the highest-priority care work from Today.
- A staff user can view a person profile and see care planning context.
- Assessment records can be created and viewed.
- Care plans can be drafted or created, approved, versioned, and reviewed.
- Evidence packs can include supported allowed records through the API, include linked care plans/assessments from the current UI, and be generated/exported.
- Family users stay in family-safe routes only.
- No AWS deployment is performed.

## Verification Gates

Run before claiming the push is ready:

```bash
pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/web build
```

Also run targeted checks for:

- CareBridge access hardening.
- Visit workflow changes if any visit files were touched.
- Medication workflow changes if any medication files were touched.
- Browser QA across the core routes.

## Browser QA Route List

Use the in-app browser or browser automation to test:

- `/login`
- `/today`
- `/people`
- `/people/[id]`
- `/schedule`
- `/schedule/[id]` or `/visits/[id]`
- `/medication`
- `/family-updates`
- `/care-planning`
- `/evidence`
- `/settings`

For family access, verify:

- family users cannot access staff routes.
- family users cannot access raw visits.
- family users cannot access raw care logs.
- family users cannot access raw medication administrations or audit rows.
- revoked family access blocks the next query or refresh.

## Drift Triggers

Pause and realign if work starts drifting into:

- Infrastructure or deployment.
- Generated Prisma client edits.
- Reports or artifact cleanup.
- Major auth rewrites.
- Marketplace/referral flows.
- Payroll or billing.
- DSCR/GP Connect.
- Copying competitor wording, assets, or UI.
