# Oasis care-record policy decision packet

**Status:** awaiting qualified decisions. This document records repository evidence and the questions that block care-record implementation. It is not clinical policy, legal advice, a compliance assessment, or a claim that the current medication workflow is care-safe.

**Scope:** medication outcomes and corrections, dose occurrence identity, PRN, visit binding, late recording, Family visibility, DST, safeguarding/audit redaction, and retention/erasure/legal hold.

## 1. Decision boundary

Product and engineering can describe current behaviour, contain unsafe overwrites, preserve evidence, and implement policy-neutral integrity controls. They must not choose medication semantics, matching tolerances, disclosure rules, safeguarding access, or retention periods.

The organisation should name accountable approvers before implementation:

- a qualified clinical/medication lead for medication and dose-occurrence decisions;
- the registered manager or delegated care-operations authority for role and workflow decisions;
- the safeguarding lead for safeguarding content and access decisions; and
- the Data Protection Officer, legal adviser, and records-management owner for disclosure, retention, erasure, and legal-hold decisions.

## 2. Current repository evidence

| Area | Current evidence | Integrity consequence |
| --- | --- | --- |
| Medication record | `MedicationAdministration` holds one mutable status, one administered time/actor, and notes. `MedicationAudit.changes` is an untyped string. There is no correction/amendment chain, original/effective pair, occurrence key, or uniqueness constraint for a prescription and scheduled time. [[schema](../libs/db/prisma/schema.prisma#L180-L270)] | The schema cannot represent a correction without either overwriting the row or inventing history in an audit string. Concurrent materialisation is not protected by a database invariant. |
| Medication transitions and correction | The mutation input accepts every `MedicationStatus` plus optional notes. The service applies the supplied status to any existing row, replaces/clears administered fields, and writes the medication audit afterwards in a separate repository call. [[input](../apps/api/src/medication/dto/record-administration.input.ts#L9-L23)] [[service](../apps/api/src/medication/medication.service.ts#L176-L280)] | No transition matrix, terminal-state guard, correction authority, correction reason/evidence, optimistic concurrency, or atomic record-plus-audit write is present. A later request can replace an earlier outcome. |
| Timing rule | For an `ADMINISTERED` request, the service rejects another administered row for the same prescription inside a hard-coded 30-minute scheduled-time window. [[service](../apps/api/src/medication/medication.service.ts#L225-L250)] | This is implicit medication policy, not an approved visit-matching rule. It does not establish dose identity and must not be treated as the approved tolerance. |
| Schedule and occurrence generation | Prescription administration times are strings such as `08:00`. Materialisation creates UTC wall-clock candidates, filters duplicates in application memory, and inserts rows without a database conflict strategy. New rows contain no `visit_id`. [[schema](../libs/db/prisma/schema.prisma#L180-L225)] [[materialisation](../apps/api/src/medication/medication.service.ts#L419-L515)] [[bulk insert](../apps/api/src/medication/medication.repository.ts#L402-L438)] | There is no stable dose-occurrence model across rescheduling, reassignment, or cancellation. Concurrent generation can produce duplicate rows. `08:00` is treated as `08:00Z`, not explicitly as Europe/London local time. |
| Visit binding and late recording | Due medication is returned only by an exact existing `visit_id`; a carer may record only when that linked visit is assigned to them. The medication mutation does not check visit status. [[due query](../apps/api/src/medication/medication.repository.ts#L291-L313)] [[record access](../apps/api/src/medication/medication.service.ts#L204-L223)] Visit completion counts any linked non-scheduled medication as evidence, then marks the visit complete. [[completion](../apps/api/src/visit/visit.service.ts#L448-L510)] | There is no matching algorithm for unlinked, overlapping, or reassigned visits. A linked scheduled dose can be recorded after the visit is completed or cancelled. |
| Frontline display | The visit UI shows only the current status plus scheduled/recorded time and permits `ADMINISTERED`, `MISSED`, or `REFUSED` while the row is `SCHEDULED`. Its medication action does not check `hasStartedVisit` or `visitIsClosed`, and it does not display original and corrected-effective outcomes. [[action gate](../apps/web/app/visits/%5Bid%5D/page.tsx#L477-L607)] [[visit UI](../apps/web/app/visits/%5Bid%5D/page.tsx#L859-L949)] | The browser can also submit a scheduled medication outcome on a completed/cancelled visit. The interface cannot communicate an amendment history. |
| Family visibility | The active Carebridge path generates a versioned Family-safe title/body from completed-visit and task counts, requires exact preview approval, and returns only approved title/body/published time. [[generation and publication](../apps/api/src/carebridge/carebridge.service.ts#L250-L387)] [[Family query](../apps/api/src/carebridge/carebridge.repository.ts#L196-L216)] The Family GraphQL contract test excludes medication fields. [[web contract test](../apps/web/app/family/family-safe-graphql.test.mjs#L31-L49)] | Current active Family output exposes no medication outcome or detail. A separate status-only feed service exists, but its resolver is not registered in the module; it is not evidence of active Family behaviour. [[module](../apps/api/src/carebridge/carebridge.module.ts#L13-L25)] |
| Audit and safeguarding content | The generic interceptor stores request arguments after field-name and pattern masking for credentials and common identifiers. It does not classify clinical or safeguarding narrative. [[interceptor](../apps/api/src/common/interceptors/audit-log.interceptor.ts#L296-L364)] Medication audit serialises `changes`, including the supplied free-text note, without this masker. [[medication audit](../apps/api/src/medication/medication.repository.ts#L451-L472)] Generic audit write failure is deliberately non-blocking. [[test](../apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts#L229-L269)] | Free-text medication, clinical, or safeguarding detail can be copied into audit storage without purpose-specific minimisation. The medication update can succeed when its subsequent audit write fails. |
| Time and DST | Shared web utilities explicitly display Europe/London and test GMT/BST day boundaries. [[utility](../apps/web/lib/time.ts#L1-L120)] [[tests](../apps/web/lib/time.test.ts#L6-L22)] Medication materialisation instead uses UTC components, while “today” uses the process-local timezone. [[materialisation](../apps/api/src/medication/medication.service.ts#L442-L480)] [[today query](../apps/api/src/medication/medication.repository.ts#L316-L340)] | Medication scheduling has no explicit timezone, skipped-time, or repeated-time rule and uses inconsistent day semantics. |
| Retention, erasure, legal hold | A `RetentionPolicy` table exists, but the erasure path does not read it. The path schedules a fixed delay, deletes prescriptions, anonymises generic audit rows, and contains no legal-hold check. [[schema](../libs/db/prisma/schema.prisma#L1186-L1219)] [[erasure](../apps/api/src/gdpr/services/erasure.service.ts#L35-L207)] Medication audit is a separate model and is not explicitly processed. | Care-record retention, erasure precedence, audit treatment, and hold release are not encoded. Prescription deletion may also conflict with retained administration/audit relations. |
| Test evidence | Medication unit tests cover the happy path, missing row, assigned-carer check, overlap, and `MISSED` using a mocked repository. [[unit tests](../apps/api/src/medication/__tests__/medication.service.spec.ts#L146-L350)] A maintained database-backed visit test proves the linked-carer actor identifiers for one `SCHEDULED` to `ADMINISTERED` path. [[visit e2e](../apps/api/test/visit.e2e.spec.ts#L804-L883)] | No inspected test establishes a transition matrix, correction history, concurrent uniqueness, PRN, ambiguous binding, closed-visit late entry, medication DST behaviour, Family medication disclosure, safeguarding narrative handling, or legal-hold precedence. |

These observations describe the checked branch only. They do not establish regulatory compliance or clinically appropriate behaviour.

## 3. Policy-independent containment and integrity defaults

The following do not decide clinical meaning. They are safe engineering constraints for any later approved policy:

1. **No silent history rewrite.** Until amendment semantics are approved, reject attempts to replace a non-`SCHEDULED` medication outcome. Preserve the original record and audit evidence.
2. **Fail closed on ambiguous binding.** Do not auto-link a dose when zero, two, overlapping, or conflicting visits are plausible. Keep it unlinked and route it for authorised resolution.
3. **Atomic evidence.** A medication state change and its required audit/amendment event must commit or fail together.
4. **Explicit concurrency.** Use a database-enforced occurrence identity and compare-and-set/version checks; do not rely on a read-then-write duplicate check.
5. **Separate event times.** Preserve scheduled time, claimed occurrence time, server-recorded time, and correction time as distinct values. Never derive or overwrite one from another.
6. **Explicit temporal context.** Persist an instant and the applicable IANA timezone/local schedule representation. If a local time is skipped or repeated and no approved rule resolves it, stop and request review.
7. **Minimum disclosure.** Do not add medication or safeguarding content to Family output or general audit payloads until a purpose, audience, and approved field-level contract exist.
8. **Legal-hold stop gate.** No erasure worker should delete or anonymise a care record unless it has checked an authoritative hold state and an approved category-specific disposition rule.
9. **No clinical backfill inference.** A migration may preserve and label known legacy data; it must not infer a dose outcome, visit link, local-time fold, correction reason, or PRN intent.

## 4. Decisions requiring qualified approval

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

## 5. Acceptance cases to ratify

These are candidate test contracts, not approved policy. Bracketed values must be replaced by the signed CP decisions before they become executable specifications.

| Case | Candidate Given / When / Then | Depends on |
| --- | --- | --- |
| AC-01 Transition | Given an occurrence in `[state]`, when `[role]` submits `[outcome]`, then the server applies/rejects it according to the approved matrix; an identical retry has the approved idempotent result. | CP-01 |
| AC-02 Correction evidence | Given a terminal outcome, when an authorised correction is submitted with the required reason/evidence and approvals, then the original is immutable, an amendment is appended, and actor plus occurred/recorded/corrected times remain attributable. | CP-01, CP-02 |
| AC-03 Display | Given an amended occurrence, each authorised operational, clinical, audit, export, and Family view renders exactly the approved original/effective representation and labels. | CP-03, CP-08 |
| AC-04 Concurrency and identity | Given two concurrent materialisers or recorders for the same approved occurrence, at most one occurrence/effective event is created; reschedule/reassignment/cancellation follows the ratified identity table. | CP-04 |
| AC-05 PRN | Given the approved PRN prescription and context, recording is accepted only when all approved indication, interval, maximum, evidence, and follow-up rules pass; failed checks preserve the attempt without inventing administration. | CP-05 |
| AC-06 Visit ambiguity | Given zero or multiple eligible visits, automatic binding does not occur. An authorised resolution records candidates, decision, actor, reason, and time. An exact single match follows the approved tolerance and precedence. | CP-06 |
| AC-07 Late entry | Given a completed/cancelled visit, a late outcome is rejected or routed according to the approved role/window; if accepted, the visit history is not rewritten and occurrence time remains distinct from recording time. | CP-07 |
| AC-08 Family disclosure | Given each outcome and correction state, a Family member receives only fields approved for their scopes through the exact versioned preview; safeguarding restriction or revoked access fails closed. | CP-08, CP-10 |
| AC-09 DST spring | Given a prescribed local time that does not exist on the Europe/London spring transition, materialisation follows the approved skip/move/review rule without silently changing dose identity. | CP-04, CP-09 |
| AC-10 DST autumn | Given a prescribed local time that occurs twice on the Europe/London autumn transition, the approved one/two/fold rule produces stable, distinguishable occurrences and deterministic queries. | CP-04, CP-09 |
| AC-11 Safeguarding redaction | Given clinical or safeguarding narrative containing and not containing obvious PII patterns, only approved purpose-specific fields enter each audit/log/export/Family sink; access and audit-failure behaviour match CP-10. | CP-10 |
| AC-12 Retention and hold | Given an erasure request with an active hold, no covered record changes. Without a hold, each category follows its approved disposition and dependency order, preserves required amendment/audit evidence, and records proof of the action. | CP-11 |

## 6. Implementation dependencies and safety gates

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

## 7. Approver response record

For each CP item, record:

- exact rule, including role, state, timing, exception, and evidence requirements;
- accountable approver name/role and approval date;
- policy/source version and review date;
- affected audiences and data categories;
- accepted/rejected acceptance cases and filled bracketed values;
- unresolved exception and owner; and
- whether existing records require no action, preservation-only labelling, or an independently approved migration/backfill plan.

Approval is complete only when every implementation-relevant term is explicit. “Use best judgement”, “normal practice”, and an unexplained numeric tolerance are not implementable decisions.
