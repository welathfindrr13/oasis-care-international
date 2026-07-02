# Issue #15 Phase 1 Tenant Nullability Inventory

This Phase 1 artifact inventories sensitive tenant-owned records that still allow nullable `organization_id`.
It does not change schema nullability, create a migration, backfill data, or mutate staging/production data.

## Nullable Sensitive Tenant Models

| Model | Table | Nullable `organization_id` | Organization relation | Constraints/indexes | Creation path | Risk category |
| --- | --- | --- | --- | --- | --- | --- |
| Carer | `carer` | YES | YES | global `email` unique, `organization_id` index | `CarerRepository.upsertById`, `AiSummaryService.resolveApproverId`, demo/seed | cross-tenant identity, payroll/visit integrity |
| Client | `client` | YES | YES | no tenant unique, no tenant index in schema | `ClientRepository.create`, demo/seed | cross-tenant visibility, orphaned care record |
| Visit | `visit` | YES | YES | `organization_id`, carer/client/time indexes | `VisitRepository.create`, demo/seed | visit integrity, cross-tenant visibility |
| CarerShift | `carer_shift` | YES | YES | `organization_id`, carer/time indexes | `ShiftRepository.createShift` | payroll/visit integrity |
| MedicationAudit | `medication_audit` | YES | YES | `organization_id`, prescription/admin/timestamp indexes | `MedicationRepository.createMedicationAudit` | audit/compliance gap |
| Assessment | `assessment` | YES | no explicit relation in schema | `organization_id`, client/visit/status indexes | `CarePlanningRepository.createAssessment`, seed | orphaned care record, export ambiguity |
| CarePlan | `care_plan` | YES | no explicit relation in schema | `organization_id`, client/assessment/status indexes | `CarePlanningRepository.createCarePlan`, seed | care workflow integrity |
| EvidencePack | `evidence_pack` | YES | no explicit relation in schema | `organization_id`, client/plan/status/period indexes | `CarePlanningRepository.createEvidencePack`, seed | export/privacy ambiguity |
| CareLog | `care_log` | YES | YES | `organization_id`, visit/client/carer indexes | `CareLogRepository.create` | care note privacy, orphaned care record |
| ConsentRecord | `consent_record` | YES | YES | `organization_id`, user/type/granted indexes | `ConsentService.grantConsent` | GDPR ambiguity |
| AuditLog | `audit_log` | YES | YES | `organization_id`, user/action/resource/timestamp indexes | audit interceptor, service audit writes | audit/compliance gap |
| ErasureQueue | `erasure_queue` | YES | YES | `organization_id`, user/status/scheduled indexes | `ErasureService.enqueueDataErasure`, `SarService.enqueueSubjectAccessRequest` | deletion/export ambiguity |

## Creation Path Findings

- Primary API service paths already derive tenant context from authenticated organization membership before calling repositories.
- Phase 1 adds repository/service boundary guards so missing, empty, or whitespace tenant IDs fail before sensitive Prisma `create` calls.
- `AiSummaryService.resolveApproverId` performs a direct Carer create when an approver profile is missing; Phase 1 guards that path before Prisma create.
- Synthetic demo and Prisma seed paths now write `organization_id` on Carer and Visit rows directly instead of creating null rows and patching them later.
- The audit interceptor remains a documented exception: it can retry audit writes with nullable `organization_id` only after an audit-log organization foreign-key failure, preserving the audit event while the separate org-mapping hardening stays tracked elsewhere.

## Dry-Run Verification

Use `scripts/release/tenant-nullability-dry-run.mjs` for read-only counts:

```bash
node scripts/release/tenant-nullability-dry-run.mjs
```

The script imports the generated workspace Prisma client from `libs/db/src/generated/client`, so the command is runnable from the repository root without requiring the root package to own `@prisma/client`.

Output is limited to model/table names and counts of rows where `organization_id IS NULL`.
It does not print row data, names, emails, IDs, connection strings, secrets, tokens, cookies, or headers.

## Phase 2 Plan

1. Run the dry-run count script through an approved staging read-only lane.
2. Classify each nonzero legacy null tenant row as mapped to a verified organization or quarantined.
3. Prepare a reviewed backfill script against disposable non-client data first.
4. Re-run dry-run verification until all sensitive tables report zero nullable tenant rows or explicit quarantine.
5. Only then prepare a separate Prisma migration to make safe `organization_id` columns `NOT NULL`.
6. Rehearse rollback and deployment on staging before production approval.
