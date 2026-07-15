# Oasis care-record policy decision packet

**Status:** the initial operational launch boundary below is approved. Medication and clinical behaviour remain excluded while this packet awaits qualified, named specialist decisions. This document records repository evidence and the questions that block care-record implementation. It is not clinical policy, legal advice, a compliance assessment, or a claim that the current medication workflow is care-safe.

**Scope:** medication outcomes and corrections, dose occurrence identity, PRN, visit binding, late recording, Family visibility, DST, safeguarding/audit redaction, and retention/erasure/legal hold.

## 1. Approved initial launch behaviour

The approved launch is an empty system populated only through controlled onboarding. It covers company and first-Manager provisioning; Manager company setup; creation of care recipients; Carer invitation and management; visit scheduling and assignment; the assigned Carer's mobile Today view; visit start, supported care notes, and completion; Manager delivery status and operational exceptions; Family invitations linked to the correct care recipient; approved Family updates; immediate access revocation; and the tenant, audit, recovery, and Clerk controls needed for those journeys.

Approval of this boundary does not claim that every journey has passed launch acceptance, authorise deployment, or approve any medication or clinical behaviour. Production must begin without synthetic accounts, visits, metrics, or demo content. Automated fixtures remain confined to tests and CI.

## 2. Excluded medication and clinical behaviour

Medication management, medication amendments or corrections, medication scheduling and administration, Family medication visibility, and any unapproved clinical correction workflow are outside the initial launch. They must remain inaccessible to launch users until the relevant decisions below are signed by named specialists and the resulting controls are independently verified. The initial launch does not replace eMAR and must not be described as doing so.

This exclusion does not remove the medication code or pre-approve a later implementation. It is a release boundary: no medication schema migration, data migration, backfill, capability exposure, or clinical inference is authorised by this packet.

## 3. Decision boundary

Product and engineering can describe current behaviour, contain unsafe overwrites, preserve evidence, and implement policy-neutral integrity controls. They must not choose medication semantics, matching tolerances, disclosure rules, safeguarding access, or retention periods.

The organisation must record the accountable individual's name, role, decision, source/version, approval date, and review date before implementation. Required specialist roles are:

- a qualified clinical/medication lead for medication and dose-occurrence decisions;
- the registered manager or delegated care-operations authority for role and workflow decisions;
- the safeguarding lead for safeguarding content and access decisions; and
- the Data Protection Officer, legal adviser, and records-management owner for disclosure, retention, erasure, and legal-hold decisions.

Role titles alone are not approval. The approver response record in section 9 must identify the actual person who accepted each decision.

## 4. Current repository evidence

Evidence was refreshed against verified `main` at `c5486d11a6cb877cc5d8c7daaa2ab5683a307dc7`. The decision IDs show which signed rules the code still cannot supply.

| Area | Current code fact | Engineering consequence | Open decisions |
| --- | --- | --- | --- |
| Medication record | `MedicationAdministration` holds one mutable status, one administered time/actor, and notes. `MedicationAudit.changes` is an untyped string. There is no correction/amendment chain, original/effective pair, occurrence key, or uniqueness constraint for a prescription and scheduled time. [[schema](../libs/db/prisma/schema.prisma#L180-L247)] | The schema cannot represent a correction without either overwriting the row or inventing history in an audit string. Concurrent materialisation is not protected by a database invariant. | CP-01, CP-02, CP-03, CP-04 |
| Medication transitions and correction | The mutation input accepts every `MedicationStatus` plus optional notes. The service applies the supplied status to any existing row, replaces or clears administered fields, and writes the medication audit afterwards in a separate repository call. [[input](../apps/api/src/medication/dto/record-administration.input.ts#L9-L23)] [[service](../apps/api/src/medication/medication.service.ts#L214-L318)] | No transition matrix, terminal-state guard, correction authority, correction reason/evidence, optimistic concurrency, or atomic record-plus-audit write is present. A later request can replace an earlier outcome. | CP-01, CP-02, CP-03, CP-10 |
| Timing rule | For an `ADMINISTERED` request, the service rejects another administered row for the same prescription inside a hard-coded 30-minute scheduled-time window. [[service](../apps/api/src/medication/medication.service.ts#L263-L289)] | This is an unapproved medication rule, not a dose identity or visit-matching rule, and must not be promoted into policy by default. | CP-01, CP-04, CP-06 |
| Schedule and occurrence generation | Prescription administration times are validated as unique wall-clock values such as `08:00`. Materialisation resolves each value through the organisation-timezone boundary and rejects a skipped or repeated local time before the prescription write. It still filters existing instants in application memory and bulk-inserts without a database conflict strategy; new rows contain no `visit_id`. [[schema](../libs/db/prisma/schema.prisma#L180-L225)] [[validation and materialisation](../apps/api/src/medication/medication.service.ts#L459-L608)] [[bulk insert](../apps/api/src/medication/medication.repository.ts#L405-L441)] | The timezone boundary prevents silent DST guessing, but it does not define a stable dose occurrence across rescheduling, reassignment, cancellation, or an approved DST exception. Concurrent generation can still produce duplicate rows because no database uniqueness invariant protects the occurrence. | CP-04, CP-09 |
| PRN | The prescription model and create input contain daily frequency, an optional interval, wall-clock administration times, and free-text instructions. They contain no PRN marker, indication, maximum-dose window, effectiveness review, or PRN-specific omission/refusal model. [[schema](../libs/db/prisma/schema.prisma#L180-L202)] [[input](../apps/api/src/medication/dto/create-prescription.input.ts#L20-L70)] | Existing fixed-schedule fields cannot be treated as an approved PRN contract. | CP-05 |
| Visit binding and late recording | Due medication is returned only by an exact existing `visit_id`; a carer may record only when that linked visit is assigned to them. The medication mutation does not check visit status. [[due query](../apps/api/src/medication/medication.repository.ts#L296-L318)] [[record access](../apps/api/src/medication/medication.service.ts#L214-L261)] Visit completion counts any linked non-scheduled medication as evidence, then marks the visit complete. [[completion](../apps/api/src/visit/visit.repository.ts#L448-L477)] | There is no matching algorithm for unlinked, overlapping, or reassigned visits. A linked scheduled dose can be recorded after the visit is completed or cancelled. | CP-06, CP-07 |
| Frontline display | The visit UI shows only the current medication status plus scheduled/recorded time and permits `ADMINISTERED`, `MISSED`, or `REFUSED` while the row is `SCHEDULED`. The medication action checks capability but not `hasStartedVisit` or `visitIsClosed`, and it cannot display original and corrected-effective outcomes. [[action](../apps/web/app/visits/%5Bid%5D/page.tsx#L548-L574)] [[controls](../apps/web/app/visits/%5Bid%5D/page.tsx#L797-L882)] | The browser can submit a scheduled medication outcome on a completed/cancelled visit. The interface cannot communicate amendment history. | CP-01, CP-02, CP-03, CP-07 |
| Family visibility | The active Carebridge path creates a versioned Family-safe title/body from completed-visit and task counts, publishes only an exact versioned title/body match, and returns only title/body/published time. [[generation and publication](../apps/api/src/carebridge/carebridge.service.ts#L231-L398)] [[exact publish](../apps/api/src/carebridge/carebridge.repository.ts#L262-L290)] [[Family query](../apps/api/src/carebridge/carebridge.repository.ts#L214-L234)] The Family GraphQL contract test explicitly excludes medication fields. [[web contract test](../apps/web/app/family/family-safe-graphql.test.mjs#L31-L49)] | The active Family contract exposes no medication outcome or detail. A separate status-only feed service exists, but its resolver is not registered in the module and is not evidence of active Family behaviour. [[module](../apps/api/src/carebridge/carebridge.module.ts#L13-L25)] | CP-03, CP-08, CP-10 |
| Audit and safeguarding content | Generic audit capture excludes medication, clinical, safeguarding, dose, prescription, concern, and eMAR domains from argument metadata. Other domains use a bounded default-deny allowlist of reviewed identifiers/workflow fields, and error logging stores bounded names/codes rather than raw messages. [[interceptor boundary](../apps/api/src/common/interceptors/audit-log.interceptor.ts#L24-L25)] [[generic capture](../apps/api/src/common/interceptors/audit-log.interceptor.ts#L77-L102)] [[metadata policy](../apps/api/src/common/audit/audit-metadata.policy.ts#L4-L71)] Medication audit separately serialises `changes`, including the supplied free-text note, without this policy. [[medication audit](../apps/api/src/medication/medication.repository.ts#L454-L475)] Generic audit write failure is deliberately non-blocking. [[failure path](../apps/api/src/common/interceptors/audit-log.interceptor.ts#L163-L206)] | The generic sink is default-deny, but free-text medication detail can still enter the separate medication audit without a purpose-specific contract, and the medication update can succeed when its later audit write fails. Safeguarding classification and access for any future purpose-specific care-record audit remain undecided. | CP-02, CP-10, CP-11 |
| Time and DST | One organisation-timezone resolver supplies `Europe/London` for the UK pilot while allowing a future resolver without a schema dependency. It exposes 23/25-hour calendar-day ranges and distinguishes unique, skipped, and repeated wall times without guessing. [[resolver](../libs/time/src/organization-timezone.ts#L1-L56)] [[wall-time and range boundary](../libs/time/src/organization-timezone.ts#L225-L295)] [[DST tests](../libs/time/src/organization-timezone.test.ts#L21-L67)] Medication materialisation converts wall-clock values to UTC instants and rejects skipped or repeated times with `MEDICATION_SCHEDULE_TIME_UNRESOLVED`; eMAR “today” uses the same organisation calendar-day range. [[materialisation](../apps/api/src/medication/medication.service.ts#L519-L608)] [[DST rejection tests](../apps/api/src/medication/__tests__/medication.service.spec.ts#L706-L760)] [[today query](../apps/api/src/medication/medication.repository.ts#L320-L372)] | The engineering boundary is consistent and fails closed, but clinical policy has not chosen what a skipped or repeated medication time means, whether one or two autumn occurrences exist, or how that decision affects occurrence identity. | CP-04, CP-09 |
| Retention, erasure, legal hold | A `RetentionPolicy` table exists, but the erasure path does not read it. The path schedules a fixed delay, deletes prescriptions, anonymises generic audit rows, and contains no legal-hold check. [[schema](../libs/db/prisma/schema.prisma#L1186-L1219)] [[erasure](../apps/api/src/gdpr/services/erasure.service.ts#L35-L207)] Medication audit is a separate model and is not explicitly processed. | Care-record retention, erasure precedence, audit treatment, and hold release are not encoded. Prescription deletion may also conflict with retained administration/audit relations. | CP-10, CP-11 |
| Test evidence | Medication outcome and wall-time service tests use mocked repositories. [[outcome tests](../apps/api/src/medication/__tests__/medication.service.spec.ts#L146-L350)] [[wall-time tests](../apps/api/src/medication/__tests__/medication.service.spec.ts#L522-L760)] Repository tests cover 23/25-hour eMAR query ranges with a mocked Prisma client. [[eMAR range tests](../apps/api/src/medication/medication.repository.spec.ts#L67-L105)] A database-backed visit test proves linked-carer actor identifiers for one `SCHEDULED` to `ADMINISTERED` path. [[visit e2e](../apps/api/test/visit.e2e.spec.ts#L806-L883)] | No inspected test establishes an approved transition matrix, correction history, concurrent occurrence uniqueness, PRN, ambiguous binding, closed-visit late entry, DST exception rule, Family medication disclosure, safeguarding narrative handling, or legal-hold precedence. | CP-01 through CP-11 |

The baseline includes the shift-integrity change at [`5ba1e301`](https://github.com/welathfindrr13/oasis-care-international/commit/5ba1e3011f96a7812214b21895468f29ed635500) and the merged visit-integrity change at [`c6dacfab`](https://github.com/welathfindrr13/oasis-care-international/commit/c6dacfab4acb6e21a0a1a23d1410cac22674ff95). They harden shift concurrency and serialise visit start/completion, task, care-note, schedule, and delete writes, including atomic visit completion/audit. They do not change medication semantics: the medication mutation still has no visit-state gate and the browser medication action remains capability-only. [[visit transactions](https://github.com/welathfindrr13/oasis-care-international/blob/c6dacfab4acb6e21a0a1a23d1410cac22674ff95/apps/api/src/visit/visit.repository.ts#L225-L723)] [[medication action](https://github.com/welathfindrr13/oasis-care-international/blob/c6dacfab4acb6e21a0a1a23d1410cac22674ff95/apps/web/app/visits/%5Bid%5D/page.tsx#L548-L574)] Those engineering changes therefore do not answer CP-01 through CP-11.

These observations describe code facts, not clinical, privacy, safeguarding, legal, or records-management decisions. They do not establish regulatory compliance or clinically appropriate behaviour.

### Release-scope recommendation

The evidence supports releasing visit and shift integrity work independently while keeping medication and eMAR capabilities inaccessible to all pilot users, including Family users, until CP-01 through CP-11 are signed and the resulting server-side controls are independently verified. The current no-medication Family contract must remain unchanged. This packet authorises no medication schema migration, data migration, or backfill.

## 5. Policy-independent containment and integrity defaults

The following do not decide clinical meaning. They are safe engineering constraints for any later approved policy:

1. **No silent history rewrite.** Until amendment semantics are approved, reject attempts to replace a non-`SCHEDULED` medication outcome. Preserve the original record and audit evidence.
2. **Fail closed on ambiguous binding.** Do not auto-link a dose when zero, two, overlapping, or conflicting visits are plausible. Keep it unlinked. This containment does not preselect a review queue or resolution workflow; any later resolution path requires CP-06 approval.
3. **Atomic evidence.** A medication state change and its required audit/amendment event must commit or fail together.
4. **Explicit concurrency.** Use a database-enforced occurrence identity and compare-and-set/version checks; do not rely on a read-then-write duplicate check.
5. **Separate event times.** Preserve scheduled time, claimed occurrence time, server-recorded time, and correction time as distinct values. Never derive or overwrite one from another.
6. **Explicit temporal context.** Persist an instant and the applicable IANA timezone/local schedule representation. If a local time is skipped or repeated and no approved rule resolves it, stop and request review.
7. **Minimum disclosure.** Do not add medication or safeguarding content to Family output or general audit payloads until a purpose, audience, and approved field-level contract exist.
8. **Legal-hold stop gate.** No erasure worker should delete or anonymise a care record unless it has checked an authoritative hold state and an approved category-specific disposition rule.
9. **No clinical backfill inference.** A migration may preserve and label known legacy data; it must not infer a dose outcome, visit link, local-time fold, correction reason, or PRN intent.

## 6. Decisions requiring qualified approval

No value in this table is preselected. “Required answer” means the approver must supply an explicit, versioned rule.

| ID | Decision owner(s) | Required answer | Implementation remains blocked on |
| --- | --- | --- | --- |
| CP-01 | Clinical/medication lead | The permitted transition matrix for `SCHEDULED`, `ADMINISTERED`, `MISSED`, `REFUSED`, and `CANCELLED`; which states are terminal; whether identical retries are idempotent; and what happens when an outcome is disputed. | API state machine, error contract, idempotency, UI actions, tests. |
| CP-02 | Clinical/medication lead; registered manager | Which roles may request, approve, or apply a correction for each outcome; whether dual authorisation is required; time limits/escalation; mandatory reason categories, narrative, and evidence; and whether the original actor is notified. | Capability design, correction workflow, evidence model, audit events, UI. |
| CP-03 | Clinical/medication lead; records owner | Whether operational, clinical-review, audit, export, and Family views display the original record, the effective corrected record, or both; required labels and timestamps. | Read model, DTOs, eMAR/UI, exports, Family projection. |
| CP-04 | Clinical/medication lead | What constitutes the same dose occurrence across schedule edits, visit reassignment, visit cancellation, prescription suspension/restart, and daylight-saving changes; when a new occurrence must be created. | Occurrence key/schema, uniqueness, rescheduling rules, migration. |
| CP-05 | Clinical/medication lead | PRN eligibility, authorisation, indication/reason, minimum interval and maximum dose rules, effectiveness/review recording, refusals/omissions, stock implications, and whether PRN creates scheduled occurrences. | PRN schema and workflow; validation; alerts; UI; tests. |
| CP-06 | Clinical/medication lead; care operations | Whether a dose must be attached to a visit; the approved matching inputs and any tolerance; precedence for overlapping/reassigned visits; who resolves unassigned/ambiguous records; and whether manual binding requires evidence or approval. | Deterministic matcher, review queue, binding history, permissions, tests. |
| CP-07 | Clinical/medication lead; registered manager | Whether and by whom an outcome may be recorded after visit completion/cancellation; permitted elapsed time; required reason/evidence; escalation; and the relationship between occurred, recorded, and visit-completion times. | Server-side visit-state gate, late-entry workflow, amendment/audit model, UI. |
| CP-08 | Clinical/medication lead; safeguarding lead; privacy owner | Which of `ADMINISTERED`, `MISSED`, `REFUSED`, `CANCELLED`, and `AMENDED` may be shown to each Family audience; detail level; delay/approval; correction handling; and safeguarding exceptions. | Versioned Family projection/preview, scopes, approval contract, revocation tests. |
| CP-09 | Clinical/medication lead; care operations | Whether prescription times represent local wall-clock or elapsed/UTC time; organisation/client timezone source; the rule for a nonexistent spring time and each repeated autumn occurrence; effects on windows, reminders, and occurrence identity. | Zoned schedule model, materialiser, query-day semantics, DST migration/tests. |
| CP-10 | Safeguarding lead; clinical governance; privacy owner | Which clinical/safeguarding fields may enter operational audit, security audit, support logs, exports, and Family projections; redaction vs restricted retention; access and break-glass rules; and how audit failure affects a care-record write. | Data classification, purpose-specific audit DTOs, restricted store/access, redaction and failure-mode tests. |
| CP-11 | DPO/legal; records-management owner; clinical governance | Retention period and legal basis per record category; start event; relationship between original/amended records and audit; erasure/anonymisation rules; active investigation/complaint/safeguarding/legal-hold precedence; hold creation/release authority; and evidence of disposition. | Policy registry, hold schema/check, erasure planner, dependency-safe deletion/anonymisation, disposition audit and tests. |

## 7. Acceptance cases to ratify

These are candidate test contracts, not approved policy. Bracketed values must be replaced by the signed CP decisions before they become executable specifications.

| Case | Candidate Given / When / Then | Depends on |
| --- | --- | --- |
| AC-01 Transition | Given an occurrence in `[state]`, when `[role]` submits `[outcome]`, then the server applies/rejects it according to the approved matrix; an identical retry has the approved idempotent result. | CP-01 |
| AC-02 Correction evidence | Given a terminal outcome, when an authorised correction is submitted with the required reason/evidence and approvals, then the original is immutable, an amendment is appended, and actor plus occurred/recorded/corrected times remain attributable. | CP-01, CP-02 |
| AC-03 Display | Given an amended occurrence, each authorised operational, clinical, audit, export, and Family view renders exactly the approved original/effective representation and labels. | CP-03, CP-08 |
| AC-04 Concurrency and identity | Given two concurrent materialisers or recorders for the same approved occurrence, at most one occurrence/effective event is created; reschedule/reassignment/cancellation follows the ratified identity table. | CP-04 |
| AC-05 PRN | Given the approved PRN prescription and context, recording is accepted only when all approved indication, interval, maximum, evidence, and follow-up rules pass. Whether a rejected attempt is retained, and in which purpose-specific record, is applied only as approved under CP-10 and CP-11; rejection never invents an administration. | CP-05, CP-10, CP-11 |
| AC-06 Visit ambiguity | Given zero or multiple eligible visits, automatic binding does not occur. An authorised resolution records candidates, decision, actor, reason, and time. An exact single match follows the approved tolerance and precedence. | CP-06 |
| AC-07 Late entry | Given a completed/cancelled visit, a late outcome is rejected or routed according to the approved role/window; if accepted, the visit history is not rewritten and occurrence time remains distinct from recording time. | CP-07 |
| AC-08 Family disclosure | Given each outcome and correction state, a Family member receives only fields approved for their scopes through the exact versioned preview; safeguarding restriction or revoked access fails closed. | CP-08, CP-10 |
| AC-09 DST spring | Given a prescribed local time that does not exist on the Europe/London spring transition, materialisation follows the approved skip/move/review rule without silently changing dose identity. | CP-04, CP-09 |
| AC-10 DST autumn | Given a prescribed local time that occurs twice on the Europe/London autumn transition, the approved one/two/fold rule produces stable, distinguishable occurrences and deterministic queries. | CP-04, CP-09 |
| AC-11 Safeguarding redaction | Given clinical or safeguarding narrative containing and not containing obvious PII patterns, only approved purpose-specific fields enter each audit/log/export/Family sink; access and audit-failure behaviour match CP-10. | CP-10 |
| AC-12 Retention and hold | Given an erasure request with an active hold, no covered record changes. Without a hold, each category follows its approved disposition and dependency order, preserves required amendment/audit evidence, and records proof of the action. | CP-11 |

## 8. Implementation dependencies and safety gates

1. Record signed, versioned answers to CP-01 through CP-11, including named approvers and review date. Do not turn existing code constants into policy by default.
2. Produce the medication occurrence/amendment schema and migration design. Include legacy classifications (`known`, `unknown`, `ambiguous`) and prohibit clinical inference.
3. Independently review medication and visit changes for clinical data integrity, auth/tenancy, audit atomicity, and migration/backfill safety.
4. Add real PostgreSQL concurrency and constraint tests, plus tenant/auth fixtures. Mock-only service tests are insufficient for uniqueness or transaction claims.
5. Implement the server-side transition, visit-state, correction-authority, and ambiguous-binding gates before enabling corresponding UI controls.
6. Replace general argument capture for sensitive workflows with approved purpose-specific audit events; verify redaction using clinical and safeguarding narratives, not only obvious identifier patterns.
7. Make medication scheduling and query boundaries use one approved zoned-time model; test normal days plus both Europe/London DST transitions.
8. Version the Family medication projection and exact approval preview separately from internal clinical records. Preserve the current no-medication Family contract until CP-08 and CP-10 are signed.
9. Design retention, erasure, dependency order, and legal hold together. Do not run a care-record erasure/backfill/migration against shared or live data from this packet.
10. After each integrated change, rerun affected tests and an independent diff review. Deployment and production-readiness decisions remain separate gates.

## 9. Approver response record

For each CP item, record:

- exact rule, including role, state, timing, exception, and evidence requirements;
- accountable approver name/role and approval date;
- policy/source version and review date;
- affected audiences and data categories;
- accepted/rejected acceptance cases and filled bracketed values;
- unresolved exception and owner; and
- whether existing records require no action, preservation-only labelling, or an independently approved migration/backfill plan.

Approval is complete only when every implementation-relevant term is explicit. “Use best judgement”, “normal practice”, and an unexplained numeric tolerance are not implementable decisions.
