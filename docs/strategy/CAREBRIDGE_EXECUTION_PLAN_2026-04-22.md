# Oasis CareBridge Execution Plan

Date: 2026-04-22
Owner: Founder + Product + Engineering
Status: Active working plan

## 1. Purpose

This document is the anti-drift plan for Oasis CareBridge.

It defines:
- what CareBridge is,
- what has already been implemented,
- what comes next,
- what must not change without an explicit decision,
- and how CareBridge work will be released to AWS safely.

CareBridge is not a generic family portal.

CareBridge is:

> Proof-of-care, family assurance, and concern-resolution infrastructure for domiciliary care agencies.

The product spine remains:

```txt
Visit completed
→ verified visit story drafted from operational records
→ staff approves
→ family sees approved update
→ family raises concern if needed
→ agency acknowledges / responds / resolves
→ evidence trail captured
```

If future work weakens that loop, it is drift.

## 2. Non-Negotiable Product Rules

These rules stay fixed unless explicitly changed in writing.

1. Family users do not read raw operational care records directly.
2. Operational records remain the source of truth.
3. CareBridge records are projections, workflow artifacts, or communication artifacts.
4. Carers must not record care twice.
5. Manual approval remains the default for family-visible content until low-risk automation is explicitly approved.
6. Medication visibility is status-only by default.
7. CareBridge is not marketed as a DSCR replacement unless Oasis deliberately chooses that path.
8. CareBridge is not a marketplace-first product.
9. Proof-of-care does not mean proof of clinical adequacy or a guarantee of quality.
10. Family access is object-scoped, not role-global.

## 3. What Is Already Implemented

As of 2026-04-22, the following foundation is in place.

### 3.1 Backend foundation

The schema and API now have a real CareBridge base:
- family/external access models
- care rooms
- memberships
- access grants
- CareBridge policy records
- verified visit story records
- concern workflow records
- weekly summary and pulse models scaffolded in schema

Implemented backend areas include:
- `apps/api/src/carebridge/carebridge.module.ts`
- `apps/api/src/carebridge/carebridge.resolver.ts`
- `apps/api/src/carebridge/carebridge.service.ts`
- `apps/api/src/carebridge/carebridge.repository.ts`
- `apps/api/src/carebridge/access/carebridge-access.service.ts`
- `apps/api/src/carebridge/feed/carebridge-feed.service.ts`
- `apps/api/src/carebridge/concern/carebridge-concern.service.ts`

Implemented backend capabilities:
- create care room
- invite/link family contact
- update policy
- list care rooms for staff/family
- generate verified visit story
- publish verified visit story
- raise concern
- update concern status
- submit family pulse
- audit log writes for key CareBridge events

### 3.2 Frontend foundation and usability pass

The app is already clearer than before:
- staff-facing CareBridge landing page exists
- family-facing landing page exists
- shared header now adapts to staff vs family context
- dashboard copy and navigation are clearer
- middleware now routes external users into `/family`

Implemented frontend areas include:
- `apps/web/app/carebridge/page.tsx`
- `apps/web/app/family/page.tsx`
- `apps/web/components/oasis/Header.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/lib/auth/access.ts`

### 3.3 Verification already achieved

The following checks have already passed on this branch:
- `pnpm --filter @oasis/db generate`
- `pnpm --filter @oasis/api test -- --runInBand src/carebridge/__tests__/carebridge.service.spec.ts`
- `pnpm --filter @oasis/api test -- --runInBand src/carebridge/access/carebridge-access.service.spec.ts src/carebridge/feed/carebridge-feed.service.spec.ts src/carebridge/concern/carebridge-concern.service.spec.ts`
- `pnpm --filter @oasis/api build`
- `node --import tsx --test apps/web/lib/auth/access.test.ts`
- `pnpm --filter @oasis/web build`

## 4. What Is Not Done Yet

The rest of CareBridge is still ahead of us.

Not yet complete:
- full consolidation of duplicate CareBridge backend entry points
- family concern thread UI with staff workflow depth
- owner assignment in the concern workflow UI/backend
- weekly care summary generation and UI
- evidence pack generation
- care confidence status
- management dashboards
- read receipts strategy
- notification system
- document-sharing layer
- family operations layer
- growth/intake/referral layer
- AWS release of these new changes

## 5. Delivery Order

This is the enforced implementation order unless explicitly changed.

### Phase 1A: Security hardening of existing surfaces

Goal:
- ensure new family/external users cannot reach legacy operational data directly

Must include:
- audit all existing resolvers currently accessible to `client` or generic authenticated users
- make raw `visit`, `care-log`, `medication`, `ai-summary`, `stats`, and similar operational APIs staff/client-self only by explicit policy
- confirm family users can only access CareBridge-specific resolvers
- verify route-level and GraphQL-level enforcement both hold

Acceptance:
- family user cannot access staff operational routes
- family user cannot query raw GraphQL operational records
- revoked family membership loses access immediately on requery

Status:
- completed on the current branch with resolver hardening, legacy operational surface checks, middleware family routing, and focused access tests/build verification

### Phase 1B: Verified Visit Story workflow completion

Goal:
- turn current backend foundation into a usable proof-of-care workflow

Must include:
- staff approval queue for draft verified visit stories
- client-level CareBridge management screen
- room detail page for staff
- family room detail page showing approved stories only
- source-ref visibility for staff reviewers
- rejection and edit path for stories
- clearer product wording around proof-of-care boundaries

Acceptance:
- completed visit can produce a draft
- staff can approve or reject
- family sees only approved stories
- all actions are auditable

Status:
- substantially complete on the current branch
- implemented:
  - staff approval queue route
  - client-level CareBridge route
  - family room route
  - source-ref display in approval workflow
  - explicit publish and reject story actions
  - cleaner staff/family CareBridge navigation
- remaining:
  - deeper backend consolidation between top-level and nested CareBridge entry points
  - optional edit path before approval if needed by coordinators

### Phase 1C: Concern Resolution Tracker completion

Goal:
- make concern handling operationally useful rather than message-like

Must include:
- concern inbox for staff
- state progression UI
- acknowledgement / response / resolution timestamps surfaced
- owner assignment
- outcome handling
- family view of open/resolved concern threads
- SLA badges and overdue states

Acceptance:
- every concern has owner, status, and timestamps
- staff can work from one queue
- family can follow status without calling the office

Status:
- partially complete on the current branch
- implemented:
  - organization-level concern inbox on the active public CareBridge API surface
  - staff concern inbox route
  - SLA visibility and overdue highlighting
  - acknowledge and resolve actions from the inbox
  - timestamps exposed for acknowledgement and resolution
- remaining:
  - owner assignment end-to-end
  - family concern thread pages
  - richer response/update flow beyond acknowledge/resolve

### Phase 2: Assurance layer

Goal:
- turn CareBridge into management evidence, not just family visibility

Must include:
- weekly care summary generation from approved content only
- family confidence check wired into workflow
- care confidence status with operational explainer only
- evidence pack exports
- management dashboards
- approval backlog reporting
- basic read receipts for summaries and concern views only

Acceptance:
- summaries are generated only from approved content
- evidence exports are reviewable
- dashboards show meaningful operational signals

### Phase 3: Family operations

Goal:
- expand from trust layer into controlled family coordination

Must include:
- shared documents with explicit visibility controls
- family tasks / reminders
- appointment/discharge support
- family-private vs agency-visible separation
- sibling/family coordination rules

Acceptance:
- family coordination data does not silently pollute official care records
- permissions remain understandable

### Phase 4: Growth / intake / referral

Goal:
- convert CareBridge trust into pre-care growth motion

Must include:
- care brief
- pre-care intake
- assessment handoff
- onboarding packet
- verified post-care feedback

Acceptance:
- intake data remains separate from official care records until reviewed
- no marketplace ranking logic is introduced prematurely

### Phase 5: Ecosystem / integrations

Goal:
- add platform capabilities only after the trust and assurance layer is proven

Must include:
- outbox/eventing
- notification system
- export/report workers
- integration APIs
- DSCR/MODS-aligned mapping only if company strategy requires it

Acceptance:
- infrastructure is justified by demonstrated workflow load, not by speculation

## 6. User Experience Anti-Drift Rules

The app was described as hard to use and hard to understand. That remains a first-class problem.

These UX rules apply to all future CareBridge and core app work:

1. Every major page must answer “what should I do next?”
2. Staff pages should be exception-first, not database-first.
3. Family pages should be reassurance-first, not feature-first.
4. Navigation labels must use plain language instead of internal jargon.
5. Any new page should define its primary user, primary question, and primary action before implementation.
6. Avoid adding isolated microsurfaces that create another inbox or another place to check.
7. Dashboard content should orient by workflow, not just by stats.
8. Product wording must stay consistent:
   - `Verified Visit Story`
   - `Resolution Tracker`
   - `Evidence Trail`
   - `Family Assurance Room`
9. Avoid exposing operational complexity directly to families.
10. If a feature makes staff do duplicate work, redesign it.

## 7. CareBridge Data Boundaries

Official records:
- `Visit`
- `VisitTask`
- `CareLog`
- `MedicationAdministration`
- `MedicationAudit`
- `HealthSummary`
- `ConsentRecord`
- `AuditLog`

CareBridge access records:
- `FamilyContact`
- `CareRoom`
- `CareRoomMembership`
- `AccessGrant`
- `CareBridgePolicy`

CareBridge projection records:
- `VerifiedVisitStory`
- `WeeklyCareSummary`
- later `CareConfidenceSnapshot`

CareBridge workflow records:
- `Concern`
- `ConcernMessage`
- `ConcernEvent`
- `FamilyPulse`
- later `EvidencePackRun`

Never expose directly to family users:
- raw `CareLog`
- raw `MedicationAdministration`
- raw `MedicationAudit`
- internal `HealthSummary`
- staff-only notes
- safeguarding-sensitive records
- workforce/admin metrics

## 8. Release Gates Before Any AWS Deployment

No CareBridge deployment goes to AWS unless all of the following are true.

### Required engineering gates

1. Relevant tests pass.
2. `@oasis/api` builds cleanly.
3. `@oasis/web` builds cleanly.
4. Prisma client is regenerated when schema changes.
5. Required migrations exist for schema changes.
6. No unresolved P1/P2 issues remain.

### Required CareBridge gates

1. External-user route restrictions are verified.
2. Family user cannot access raw operational GraphQL surfaces.
3. Revocation behavior is tested.
4. Story approval path is tested.
5. Concern workflow path is tested.
6. Audit trail exists for key CareBridge actions.

### Required operational gates

1. Latest reliability artifacts pass.
2. Rollback target is known.
3. Deployment owner is named.
4. Monitoring owner is named.
5. Post-deploy smoke plan is prepared.

## 9. AWS Deployment Path We Will Use At The End

Yes: the intended release path remains AWS ECS/Fargate in `eu-west-2`.

The release process should continue to follow the existing deployment/runbook structure, not an improvised path.

Primary references:
- `infrastructure/README.md`
- `docs/DEPLOY_CHECKLIST.md`
- `docs/PRODUCTION_RELEASE_RUNBOOK.md`
- `docs/BUYER_ACCEPTANCE_EVIDENCE.md`

Expected deployment shape:

```txt
local verification
→ generate Prisma client
→ run relevant tests
→ build API and Web
→ create/verify migration
→ build API/Web images
→ push image digests
→ update ECS task definitions
→ update ECS services
→ wait for service stability
→ run health + smoke checks
→ monitor
→ rollback if needed
```

Do not deploy CareBridge by hand-waving. Use the immutable image-digest release path already documented in the production runbook.

## 10. Exact Pre-Deploy Checklist For CareBridge Work

Before staging or production push:

```bash
pnpm --filter @oasis/db generate
pnpm --filter @oasis/api test -- --runInBand src/carebridge/__tests__/carebridge.service.spec.ts
pnpm --filter @oasis/api test -- --runInBand src/carebridge/access/carebridge-access.service.spec.ts src/carebridge/feed/carebridge-feed.service.spec.ts src/carebridge/concern/carebridge-concern.service.spec.ts
pnpm --filter @oasis/api build
node --import tsx --test apps/web/lib/auth/access.test.ts
pnpm --filter @oasis/web build
```

If the change touches migrations:

```bash
pnpm --filter @oasis/db migrate
```

If the change is release-candidate quality:

```bash
pnpm release:staging:reliability
pnpm release:readiness-report
```

## 11. Decision Log

These decisions are now fixed unless explicitly changed in a new written decision log entry.

1. CareBridge is a trust layer, not a family portal.
2. The core wedge is proof-of-care + resolution + evidence.
3. Weekly summaries support the wedge but do not replace it.
4. Family pulse is subordinate to workflow, not vanity analytics.
5. Marketplace/referral work is delayed until the trust layer works.
6. Manual approval remains default early.
7. Medication visibility remains conservative.
8. The app UX must become simpler and more workflow-led as CareBridge grows.

## 12. Next Three Concrete Work Items

If implementation resumes immediately, do these next:

1. Harden legacy GraphQL surfaces so family/external users cannot reach raw operational data.
2. Build the staff approval queue and room-detail UI for verified visit stories.
3. Build the staff concern inbox and family concern-thread UI with SLA/status visibility.

That sequence preserves the product spine and avoids adding more surface area before access and workflow are safe.
