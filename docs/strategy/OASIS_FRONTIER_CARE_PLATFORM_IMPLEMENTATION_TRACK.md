# Oasis Frontier Care Platform Implementation Track

## Product Spine

Oasis is being built as a proof-led domiciliary care operating system, not a generic family portal or CareDocs clone.

Core loop:

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

CareBridge remains the trust layer, now product-facing as Family Updates and Family Assurance. It should project approved, source-linked reassurance from operational care records; it should not expose raw care logs, raw medication rows, staff notes, safeguarding-sensitive details, or unapproved AI output.

## Strategic Positioning

Oasis should compete on five pillars:

- Plan: assessment-led care plans, risks, preferences, goals, and review dates.
- Deliver: guided care visits, care actions, Medication Round, and Care Notes recorded once.
- Prove: source-linked evidence from visits, Care Notes, medication exceptions, concerns, approvals, care plans, and assessments.
- Reassure: approved Verified Visit Updates, Concern Cases, Family Assurance rooms, and conservative medication-status visibility.
- Improve: command-centre action lanes for overdue visits, review queues, concerns, exceptions, care-plan reviews, and workforce compliance.

The commercial wedge is:

```txt
Every completed visit becomes an approved proof-of-care update.
Every family concern becomes a tracked resolution.
Every agency gets an evidence trail.
```

Proof-of-care must always mean “derived from recorded operational activity and approved for sharing,” not proof of clinical adequacy or guaranteed care quality.

## Current Implementation Slice

Implemented as the foundation for the full roadmap:

- Product-grade root entry page using the five-pillar strategy.
- New primary app areas: `/today`, `/people`, `/schedule`, `/medication`, `/family-updates`, `/management`, `/evidence`, `/staff`, `/policies`, `/care-planning`.
- Role-aware navigation language: Today, People, Schedule, Family Updates, Medication Round, My Shift, Management, Workforce, Reports, Settings.
- Today Command Centre action lanes using existing data first.
- Person profile hub language and tab structure over the existing Client model.
- Family Updates route aliases over the existing CareBridge implementation.
- Minimal backend care-planning foundation for assessments, care plans, and evidence packs.

## Backend Foundation Added

Care-planning module:

- Queries: `assessments`, `carePlans`, `evidencePacks`.
- Mutations: `createAssessment`, `createCarePlan`, `createEvidencePack`.
- Staff-only resolver guard using existing operational access controls.
- Organisation-scoped persistence.
- Missing-table guard so environments without the care-planning migration return a clear feature-not-enabled error instead of crashing.

Prisma foundation:

- `Assessment`
- `CarePlan`
- `EvidencePack`
- `EvidenceItem`
- Assessment/care-plan/evidence enums.
- Client back-relations for the new planning/evidence records.

## Next Implementation Order

1. Migrate/seed the new care-planning tables locally and add demo assessments/care plans/evidence packs.
2. Build real `/care-planning` screens over the new GraphQL endpoints.
3. Add person-profile tabs backed by assessments, active care plan, review due date, and evidence pack history.
4. Add command-style visit mutations for start visit, task outcome, care note submission, medication outcome, and complete visit.
5. Add care-plan review due and medication exception counts to Today Command Centre from live records.
6. Expand Family Updates with assignment, response thread, satisfied/still-concerned, overdue SLA state, and weekly approved summaries.
7. Build Evidence Pack MVP export generation with explicit inspection-ready wording and audit events.

## Guardrails

- No AWS deployment until explicitly approved.
- No DSCR, GP Connect, marketplace, payroll, advanced rostering, or clinical decision-support claims until deliberately chosen.
- AI remains draft-only, source-linked, and human-approved.
- Medication is status-only for family visibility by default; no medication advice and no names/doses by default.
- Family users stay in family-safe routes and CareBridge/Family Updates resolvers only.
- Operational records remain authoritative; family records remain projections.
