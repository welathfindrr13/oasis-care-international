# Oasis Pilot Release Story

This document packages the final pilot around the routes and workflows that are already real on `codex/repo-cleanup-20260321`.

## Core Product Story

Oasis is strongest today as an operational domiciliary-care product built around five proof points:

1. **Visits**
   - Daily queue with explicit queue states
   - Visit workspace for timing, tasks, notes, and medication context
   - Review-needed reconciliation without inventing evidence
2. **eMAR**
   - Date-scoped medication queue
   - Administered, missed, and refused recording
   - Visit-linked medication context remains visible
3. **Coordinator control**
   - Schedule, reschedule, reassign, cancel, and reconcile within the existing visit model
4. **Compliance console**
   - Admin-only subject access, erasure handling, retention enforcement, and masked audit review
5. **Legal and privacy posture**
   - In-app privacy notice, data-processing summary, security summary, and subprocessor list

## Proof Routes

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
- No care-plan authoring
- No rich event-feed style activity board
- No enterprise-scale compliance platform beyond the pilot console

## Operational Source Of Truth

Keep [STAGING_OPERATOR_RUNBOOK.md](/tmp/oasis-codex-impl-review/docs/STAGING_OPERATOR_RUNBOOK.md) as the deploy, auth, and staging-handling source of truth. This file is only the release-facing story for the frozen pilot.
