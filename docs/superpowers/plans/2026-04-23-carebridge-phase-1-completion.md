# CareBridge Phase 1 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish CareBridge Phase 1 by hardening legacy operational access, completing the Verified Visit Story workflow, and completing the concern-resolution workflow without drifting away from the proof-of-care product spine.

**Architecture:** Keep official operational records authoritative and keep CareBridge as a derived, family-safe projection and workflow layer. Use the existing CareBridge foundations already in the repo, remove overlapping paths where necessary, and finish the next tranche in this order: security hardening first, visit-story workflow second, concern tracker third.

**Tech Stack:** NestJS GraphQL, Prisma/PostgreSQL, Next.js App Router, NextAuth middleware, TypeScript, Jest, Node test runner.

---

## Source Of Truth

This plan must stay coherent with:
- `docs/strategy/CAREBRIDGE_EXECUTION_PLAN_2026-04-22.md`
- the earlier market/research stance in this thread:
  - CareBridge is not a generic family portal
  - the wedge is proof-of-care + concern resolution + evidence trail
  - family users must never read raw operational records directly

If implementation choices conflict with those rules, the implementation must change.

## Scope

This plan covers only:
- Phase 1A: security hardening
- Phase 1B: verified visit story workflow completion
- Phase 1C: concern resolution workflow completion

This plan does **not** cover:
- weekly summaries
- evidence packs
- care confidence
- notifications
- documents
- intake/referral
- AWS deployment

## Local Development Guardrail

The local app must remain runnable without AWS/Cognito dependency drift.

- Use env-gated local auth only in development.
- Local auth must never be valid in staging or production.
- Production/staging continue to use Cognito by default.
- The local workaround must reuse the same session and API proxy path so local behavior stays close to real behavior.

## Current Risk Map

These current backend surfaces are the highest-risk raw operational access points because they still allow `client` access or are part of the legacy access model:
- `apps/api/src/visit/visit.resolver.ts`
- `apps/api/src/care-log/care-log.resolver.ts`
- `apps/api/src/ai-summary/ai-summary.resolver.ts`
- `apps/api/src/client/client.resolver.ts`

These backend areas already exist for CareBridge and must become the only family-access path:
- `apps/api/src/carebridge/access/carebridge-access.service.ts`
- `apps/api/src/carebridge/carebridge.resolver.ts`
- `apps/api/src/carebridge/carebridge.service.ts`
- `apps/api/src/carebridge/care-room/care-room.resolver.ts`
- `apps/api/src/carebridge/feed/carebridge-feed.resolver.ts`
- `apps/api/src/carebridge/concern/carebridge-concern.resolver.ts`

These web files already form the new family/staff split and should be extended rather than bypassed:
- `apps/web/middleware.ts`
- `apps/web/lib/auth/access.ts`
- `apps/web/app/carebridge/page.tsx`
- `apps/web/app/family/page.tsx`
- `apps/web/components/oasis/Header.tsx`

## File Strategy

### Backend

Keep one grouped backend domain under:
- `apps/api/src/carebridge/`

Preferred ownership:
- `care-room/` for room setup, access grants, policy
- `feed/` for verified visit stories and publication
- `concern/` for resolution tracker
- `access/` for family membership/scope enforcement

Keep `apps/api/src/carebridge/carebridge.resolver.ts` and `apps/api/src/carebridge/carebridge.service.ts` only if they act as a thin composition layer. If they duplicate deeper resolvers/services, consolidate toward the nested domain structure instead of growing two parallel APIs.

### Frontend

Staff routes remain under:
- `apps/web/app/carebridge/...`
- `apps/web/app/clients/[id]/...`

Family routes remain under:
- `apps/web/app/family/...`

Do not introduce a second disconnected shell. Extend the current staff/family split.

## Task 1: Harden Legacy Operational Access

**Files:**
- Modify: `apps/api/src/visit/visit.resolver.ts`
- Modify: `apps/api/src/care-log/care-log.resolver.ts`
- Modify: `apps/api/src/ai-summary/ai-summary.resolver.ts`
- Modify: `apps/api/src/client/client.resolver.ts`
- Modify: `apps/api/src/auth/gql-roles.guard.ts`
- Modify: `apps/api/src/auth/api-roles.guard.ts`
- Modify: `apps/web/middleware.ts`
- Modify: `apps/web/lib/auth/access.ts`
- Test: existing API resolver/service tests plus new focused authorization tests

- [x] Review each legacy resolver and remove any role pattern that allows a future family/external user to read raw operational data indirectly.
- [x] Change the role policy so legacy raw operational resolvers are staff-only or client-self-only, never generic external-user accessible.
- [x] Add or tighten API-level checks so the existence of a valid JWT is not enough for operational data access.
- [x] Keep family users limited to CareBridge-specific resolvers and `/family` routes only.
- [x] Add tests that prove:
  - family/external users cannot read raw visits
  - family/external users cannot read raw care logs
  - family/external users cannot read internal AI summaries
  - revoked users lose access on subsequent query

**Verification:**
- `pnpm --filter @oasis/api test -- --runInBand`
- `pnpm --filter @oasis/api build`
- `node --import tsx --test apps/web/lib/auth/access.test.ts`

**Done when:**
- the only family-visible path is CareBridge
- no legacy operational route or resolver leaks raw data

## Task 2: Consolidate CareBridge Backend Shape

**Files:**
- Modify: `apps/api/src/carebridge/carebridge.module.ts`
- Modify: `apps/api/src/carebridge/carebridge.resolver.ts`
- Modify: `apps/api/src/carebridge/carebridge.service.ts`
- Modify: `apps/api/src/carebridge/care-room/care-room.resolver.ts`
- Modify: `apps/api/src/carebridge/care-room/care-room.service.ts`
- Modify: `apps/api/src/carebridge/feed/carebridge-feed.resolver.ts`
- Modify: `apps/api/src/carebridge/feed/carebridge-feed.service.ts`
- Modify: `apps/api/src/carebridge/concern/carebridge-concern.resolver.ts`
- Modify: `apps/api/src/carebridge/concern/carebridge-concern.service.ts`
- Modify: `apps/api/src/carebridge/mappers.ts`
- Test: `apps/api/src/carebridge/**/*.spec.ts`

- [ ] Decide whether `carebridge.resolver.ts` is the public aggregator and the nested resolvers are internal helpers, or whether the nested resolvers are the public surface and the top-level resolver should be removed or slimmed down.
- [ ] Remove overlapping mutations/queries or duplicated mapping logic so future work lands in one clear place.
- [ ] Keep access enforcement close to each family-facing entry point.
- [ ] Keep the schema names/product language consistent with the anti-drift doc.

**Verification:**
- `pnpm --filter @oasis/api test -- --runInBand src/carebridge/__tests__/carebridge.service.spec.ts src/carebridge/access/carebridge-access.service.spec.ts src/carebridge/feed/carebridge-feed.service.spec.ts src/carebridge/concern/carebridge-concern.service.spec.ts`
- `pnpm --filter @oasis/api build`

**Done when:**
- there is one coherent CareBridge backend surface
- future contributors can tell where to add room, feed, and concern work without guessing

## Task 3: Complete Staff Verified Visit Story Workflow

**Files:**
- Create: `apps/web/app/carebridge/approvals/page.tsx`
- Create: `apps/web/app/clients/[id]/carebridge/page.tsx`
- Create: `apps/web/components/carebridge/VerifiedVisitStoryCard.tsx`
- Create: `apps/web/components/carebridge/ApprovalQueueItem.tsx`
- Create: `apps/web/components/carebridge/SourceRefList.tsx`
- Modify: `apps/web/app/carebridge/page.tsx`
- Modify: `apps/web/app/clients/[id]/page.tsx`
- Modify: `apps/web/lib/graphql/queries.ts`
- Modify: `apps/api/src/carebridge/feed/carebridge-feed.resolver.ts`
- Modify: `apps/api/src/carebridge/feed/carebridge-feed.service.ts`
- Test: web smoke tests and targeted backend feed tests

- [x] Add a staff approval queue page that lists draft verified visit stories.
- [x] Add a client-level CareBridge screen where staff can see a room overview, room access, and recent verified stories.
- [x] Show source refs to staff reviewers so proof-of-care stays auditable.
- [x] Support approve and reject actions explicitly.
- [x] Keep family-facing story wording plain-English and consistent with the product stance.

**Verification:**
- `pnpm --filter @oasis/web build`
- `pnpm --filter @oasis/api test -- --runInBand src/carebridge/feed/carebridge-feed.service.spec.ts`

**Done when:**
- staff can review, approve, and reject stories in the UI
- approved stories are the only ones visible to family users

## Task 4: Build Family Verified Visit Story Experience

**Files:**
- Create: `apps/web/app/family/care-rooms/[id]/page.tsx`
- Create: `apps/web/app/family/care-rooms/[id]/updates/page.tsx`
- Create: `apps/web/components/carebridge/FamilyAssuranceRoom.tsx`
- Create: `apps/web/components/carebridge/FamilyVisitStoryList.tsx`
- Modify: `apps/web/app/family/page.tsx`
- Modify: `apps/web/components/oasis/Header.tsx`
- Modify: `apps/web/lib/graphql/queries.ts`
- Test: web route/access tests

- [x] Replace the placeholder family landing experience with a real room-level view.
- [x] Show only approved visit stories and calm supporting copy.
- [x] Keep the family experience centered on “what happened / what changed / what needs attention”.
- [x] Do not show raw notes, internal jargon, or operational clutter.

**Verification:**
- `pnpm --filter @oasis/web build`
- `node --import tsx --test apps/web/lib/auth/access.test.ts`

**Done when:**
- an invited family user can reach a room page and see approved proof-of-care updates only

## Task 5: Complete Concern Resolution Tracker Backend

**Files:**
- Modify: `apps/api/src/carebridge/concern/carebridge-concern.service.ts`
- Modify: `apps/api/src/carebridge/concern/carebridge-concern.resolver.ts`
- Modify: `apps/api/src/carebridge/concern/dto/concern.dto.ts`
- Modify: `apps/api/src/carebridge/concern/dto/acknowledge-concern.input.ts`
- Modify: `apps/api/src/carebridge/concern/dto/respond-to-concern.input.ts`
- Modify: `apps/api/src/carebridge/concern/dto/resolve-concern.input.ts`
- Test: `apps/api/src/carebridge/concern/carebridge-concern.service.spec.ts`

- [ ] Support owner assignment cleanly.
- [x] Expose acknowledgement, response, and resolution timestamps explicitly.
- [x] Preserve immutable event history.
- [x] Expose outcome and status in a way the UI can show clearly.
- [x] Keep family actions constrained to allowed scopes only.

**Verification:**
- `pnpm --filter @oasis/api test -- --runInBand src/carebridge/concern/carebridge-concern.service.spec.ts`
- `pnpm --filter @oasis/api build`

**Done when:**
- the backend concern model fully supports the resolution tracker promised in the product plan

## Task 6: Build Staff Concern Inbox

**Files:**
- Create: `apps/web/app/carebridge/concerns/page.tsx`
- Create: `apps/web/components/carebridge/ConcernInboxList.tsx`
- Create: `apps/web/components/carebridge/ConcernResolutionTracker.tsx`
- Create: `apps/web/components/carebridge/ConcernSlaBadge.tsx`
- Modify: `apps/web/app/carebridge/page.tsx`
- Modify: `apps/web/lib/graphql/queries.ts`
- Test: web smoke tests

- [x] Add a staff concern inbox focused on status, SLA, owner, and next action.
- [x] Surface overdue states clearly.
- [x] Keep the page operational, not chat-like.
- [x] Make it obvious how a concern moves toward resolution.

**Verification:**
- `pnpm --filter @oasis/web build`

**Done when:**
- coordinators/managers can work open concerns from one place

## Task 7: Build Family Concern Thread

**Files:**
- Create: `apps/web/app/family/care-rooms/[id]/concerns/page.tsx`
- Create: `apps/web/app/family/care-rooms/[id]/concerns/[concernId]/page.tsx`
- Create: `apps/web/components/carebridge/FamilyConcernList.tsx`
- Create: `apps/web/components/carebridge/FamilyConcernThread.tsx`
- Create: `apps/web/components/carebridge/RaiseConcernForm.tsx`
- Modify: `apps/web/lib/graphql/queries.ts`
- Modify: `apps/web/app/family/page.tsx`
- Test: route/access tests

- [ ] Show open and resolved concerns clearly.
- [ ] Let family users raise concerns only where scoped.
- [ ] Keep the thread understandable without exposing internal operations.
- [ ] Surface status, who is handling it, and what happened next.

**Verification:**
- `pnpm --filter @oasis/web build`
- `node --import tsx --test apps/web/lib/auth/access.test.ts`

**Done when:**
- family users can follow a concern from first worry to resolution without chasing the office

## Task 8: Tighten Core Navigation And Workflow Copy

**Files:**
- Modify: `apps/web/components/oasis/Header.tsx`
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/carebridge/page.tsx`
- Modify: `apps/web/app/family/page.tsx`
- Modify: `apps/web/app/clients/[id]/page.tsx`
- Test: web build and smoke tests

- [ ] Keep the navigation language aligned to the product stance:
  - Verified Visit Story
  - Resolution Tracker
  - Evidence Trail
  - Family Assurance Room
- [ ] Remove any wording that slips back toward “portal” as the main concept.
- [ ] Make each major page answer what the user should do next.

**Verification:**
- `pnpm --filter @oasis/web build`

**Done when:**
- the app is easier to understand after the new CareBridge screens land, not harder

## Final Verification For This Tranche

Run all of these before calling Phase 1A-1C complete:

```bash
pnpm --filter @oasis/db generate
pnpm --filter @oasis/api test -- --runInBand src/carebridge/__tests__/carebridge.service.spec.ts
pnpm --filter @oasis/api test -- --runInBand src/carebridge/access/carebridge-access.service.spec.ts src/carebridge/feed/carebridge-feed.service.spec.ts src/carebridge/concern/carebridge-concern.service.spec.ts
pnpm --filter @oasis/api build
node --import tsx --test apps/web/lib/auth/access.test.ts
pnpm --filter @oasis/web build
```

## Stop Conditions

Stop and revisit the plan if any of these happen:
- family users need access to raw operational data to make the flow work
- staff need to duplicate carer notes for family updates
- the UI starts adding multiple disconnected CareBridge inboxes
- the module structure becomes more duplicated instead of less clear
- “proof-of-care” starts being used to imply quality guarantees or clinical adequacy

## Recommended Execution Mode

Use subagent-driven execution for this plan.

Suggested subagent split:
- backend hardening and CareBridge API consolidation
- staff proof-of-care workflow UI
- concern tracker UI

Do not execute those in parallel unless write scopes are disjoint.
