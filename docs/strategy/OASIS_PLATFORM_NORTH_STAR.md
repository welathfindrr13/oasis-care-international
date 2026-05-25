# Oasis Platform North Star

## Product Thesis

Oasis is a proof-led domiciliary care operating system for modern private-pay and mixed-funded care agencies.

The core loop is:

```txt
Assess need
-> approve care plan
-> schedule care visit
-> guide care actions
-> record care once
-> flag exceptions
-> draft family-safe update
-> resolve concerns
-> preserve evidence
-> improve care governance
```

CareBridge is the trust layer. It must sit on top of operational care records as a family-safe projection, not become a generic portal or raw-care-record viewer.

## Category

Use this category:

```txt
Proof-led care management and family assurance infrastructure for domiciliary care agencies.
```

Short buyer-facing version:

```txt
Oasis helps care agencies plan, deliver, prove, and communicate care without making carers record twice.
```

## Target Buyer

Primary buyer:

- England-based domiciliary care agency.
- Private-pay or mixed-funded.
- Roughly 50 to 500 active clients as the strongest early ICP.
- High family involvement.
- Managers are drowning in routine update calls, concern chasing, weak evidence trails, and scattered admin.

Primary internal users:

- Agency owner or director.
- Registered manager.
- Care coordinator.
- Carer.
- Family decision-maker.

## Product Pillars

1. Plan: assessments, care plans, risks, goals, preferences, review dates, approvals.
2. Deliver: visits, care actions, care notes, medication support, clock-in/out, exceptions.
3. Prove: source-linked audit trail, evidence packs, medication audit, concern timelines, care-plan reviews.
4. Reassure: approved family updates, concern cases, family pulse, safe medication-status visibility.
5. Improve: Today Command Centre, overdue work, trend signals, quality review, workforce compliance later.

## CareBridge Position

CareBridge is not the whole product. It is the family assurance layer.

CareBridge must provide:

- Verified Visit Updates derived from recorded operational activity and approved for sharing.
- Concern Cases with owner, acknowledgement, response, resolution, outcome, and audit trail.
- Family Assurance Hub with calm, approved, source-bounded updates.
- Conservative medication visibility: status-only by default, no names, no doses, no advice.
- Evidence trail that helps agencies answer family questions and complaint reviews.

CareBridge must not expose:

- Raw care logs.
- Raw medication administration rows.
- Medication audit internals.
- Internal AI summaries.
- Staff notes or performance details.
- Safeguarding-sensitive details by default.
- Unapproved or rejected family-update drafts.

## Proof-Of-Care Wording

Approved product wording:

```txt
This update was approved by the care team and is based on recorded care activity.
```

Meaning:

- It proves that family-visible content was derived from recorded operational activity.
- It proves staff approved the content for sharing.
- It does not prove clinical adequacy, guaranteed quality, or complete truth beyond the source material.

Avoid:

- "Guaranteed care quality."
- "Clinical assurance."
- "AI care decision."
- "Live access to care records."
- "Inspection pass guarantee."

## Strategic Build Order

1. UX clarity and local reliability.
2. Today Command Centre.
3. Person profile hub.
4. Visit workflow cleanup.
5. Medication round refinement.
6. Assessments MVP.
7. Care Plans MVP.
8. CareBridge completion.
9. Evidence and inspection MVP.
10. Body maps, staff training, policies, imports, billing later.

## Do Not Build Yet

Do not build these without explicit approval:

- AWS deployment.
- Marketplace or referral engine.
- GP Connect or deep NHS integrations.
- DSCR assurance claims.
- Payroll or full invoicing.
- Advanced rostering optimisation.
- Autonomous AI care-plan approval.
- AI clinical triage, diagnosis, or wound assessment.
- Raw family access to care records.

## Compliance Boundaries

Oasis handles health and care data, so UK GDPR, DPIA, access control, auditability, data minimisation, and family-authority governance matter from the start.

Default boundaries:

- Operational records remain authoritative.
- Family records remain approved projections.
- AI output is draft-only, source-linked, and human-approved.
- Medication remains safety-critical and conservative.
- Evidence packs say "inspection-ready evidence", not "guaranteed compliance".
- Oasis stays DSCR-adjacent unless the company deliberately chooses DSCR assurance.

## Competitive Position

Learn from CareDocs, Birdie, Nourish, Log my Care, CareLineLive, Unique IQ, Lottie, and Care Sourcer, but do not clone their copy, UI, branding, or structure.

Oasis wins by combining:

- Care planning depth.
- Workflow-led care delivery.
- Proof-of-care family assurance.
- Concern resolution.
- Evidence and governance.
- Better usability than table-first care systems.

