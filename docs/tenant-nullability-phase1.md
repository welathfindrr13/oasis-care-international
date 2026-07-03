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

Supported staging dry-run path: run the report inside the API container image so the generated Prisma client and matching query engine come from the same environment used by the API. This command starts a transient API container, mounts only the release script read-only, does not start dependencies, and does not deploy or restart services:

```bash
docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml run --rm --no-deps --entrypoint node \
  -v "$PWD/scripts/release:/app/scripts/release:ro" \
  api /app/scripts/release/tenant-nullability-dry-run.mjs
```

After the initial report-only counts are reviewed, run the eligible-table fail gate with `AuditLog` excluded:

```bash
docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml run --rm --no-deps --entrypoint node \
  -v "$PWD/scripts/release:/app/scripts/release:ro" \
  api /app/scripts/release/tenant-nullability-dry-run.mjs --fail-on-null --exclude AuditLog
```

`AuditLog` is excluded from the first NOT NULL gate because nullable audit rows are an intentional audit-resilience/system-event exception. The command still prints counts only and should include `Excluded models: AuditLog`.

For local/dev checks only, generate the workspace Prisma client before running the script:

```bash
pnpm tenant:nullability:dry-run:local
```

Do not use a raw Debian/Ubuntu root `node scripts/release/tenant-nullability-dry-run.mjs` command as the staging proof path; that path can use a generated client without a matching local query engine unless Prisma generation has just run for the current platform.

Output is limited to excluded model names, model/table names, and counts of rows where `organization_id IS NULL`.
It does not print row data, names, emails, IDs, connection strings, secrets, tokens, cookies, or headers. The first staging run must be report-only; do not pass `--fail-on-null` until the initial counts are reviewed.

## Phase 2 Plan

1. Run the dry-run count script through an approved staging read-only lane.
2. Classify each nonzero legacy null tenant row as mapped to a verified organization or quarantined.
3. Prepare a reviewed backfill script against disposable non-client data first.
4. Re-run dry-run verification until all sensitive tables report zero nullable tenant rows or explicit quarantine.
5. Only then prepare a separate Prisma migration to make safe `organization_id` columns `NOT NULL`.
6. Rehearse rollback and deployment on staging before production approval.
