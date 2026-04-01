# Oasis Pilot Release Story

This document packages the final pilot around the routes and workflows that are already real on `codex/repo-cleanup-20260321`.

## Core Product Story

Oasis is strongest today as an operational domiciliary-care product built around five connected proof points:

1. **Client record**
   - Operational profile, representative details, prescriptions, and visit snapshot on one record
   - Care-plan status is visible before staff move into daily delivery
2. **Care plans**
   - Staff-owned draft -> publish flow with immutable published versions
   - Active guidance is visible on the client record and inside visit detail
   - Version history and direct care-plan audit trail are reviewable in-product
3. **Visits**
   - Daily queue with explicit queue states
   - Visit workspace for timing, tasks, notes, medication context, and care guidance
   - Coordinators can schedule, reschedule, reassign, cancel, and reconcile without a separate planning system
   - Review-needed reconciliation without inventing evidence
4. **eMAR**
   - Date-scoped medication queue
   - Administered, missed, and refused recording
   - Visit-linked medication context remains visible
5. **Compliance console**
   - Admin-only subject access, erasure handling, retention enforcement, and masked audit review
   - In-app privacy notice, data-processing summary, security summary, and subprocessor list

## Proof Routes

- `/clients`
- `/clients/[id]`
- `/clients/[id]/care-plan`
- `/visits`
- `/visits/[id]`
- `/visits/[id]/edit`
- `/visits/new`
- `/emar`
- `/admin/compliance`
- `/admin/pilot`
- `/privacy`
- `/data-processing`
- `/security`
- `/subprocessors`

## Staging Verification Expectations

The final freeze should re-prove these flows in staging:

- Admin queue triage and visit creation
- Client profile updates and care-plan draft/publish/history
- Carer queue to visit workspace to completion
- Task completion and care-note persistence
- Medication outcomes from visit detail and `/emar`
- Coordinator reschedule, reassignment, cancellation, and reconciliation
- Subject access request queue/process/download
- Disposable erasure request queue/process
- Legal and privacy pages rendering live

## Known Deliberate Limits

- No rostering or planning engine
- No billing or invoicing
- No incidents, complaints, or safeguarding workflow
- No rich event-feed style activity board
- No enterprise-scale compliance platform beyond the pilot console

## Operational Source Of Truth

Keep [STAGING_OPERATOR_RUNBOOK.md](/tmp/oasis-codex-impl-review/docs/STAGING_OPERATOR_RUNBOOK.md) as the deploy, auth, and staging-handling source of truth. This file is only the release-facing story for the frozen pilot.
