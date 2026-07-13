# Tenant Isolation Gate 001

> **Historical gate snapshot.** This document is preserved because it records the origin and scope of tenant-isolation work. Its individual claims may be superseded by later implementation and tests. [The canonical Oasis pilot readiness gate](production-readiness-gate.md) owns the current verdict; unresolved tenant/auth proof remains blocking until that gate records completion.

## Current Verdict

Oasis is partially multi-tenant, but unsafe for external care-company SaaS use.

The repo already has an `Organization` model and many operational services filter by
`organization_id`. That is not enough for SaaS. Company A must never be able to
access Company B's supported people, staff, family users, CareBridge updates,
care notes, medication records, audit logs, exports, or admin data.

External-company SaaS use is blocked until all P0 tenant isolation tests pass.

## P0 Blockers From The Audit

- No explicit verified organization membership model for auth subject, tenant role, and status.
- Nullable `organization_id` remains on sensitive models such as carers, clients, visits, care logs, assessments, care plans, and evidence packs.
- Global identity uniqueness still exists in legacy models such as `Carer.email`, `FamilyContact.auth_subject`, and `OrganizationIdentity`.
- Carer upsert could move an existing profile between organizations.
- Audit logs were not tenant-aware.
- GDPR SAR, erasure, and consent services queried by raw user ID without organization scope.
- Some repository helpers updated by raw ID and depended on service-level prechecks.
- Two-tenant regression coverage was incomplete.

## What Gate 001 Fixes

- Adds explicit `OrganizationMembership` records with auth subject, identity provider, organization, tenant-scoped role, and active/suspended/revoked status.
- Hardens production/staging auth organization resolution so tenant access requires an active explicit membership.
- Keeps legacy identity/email/carer lookup only outside the tenant-membership-required SaaS gate for local/internal pilot continuity.
- Blocks unsafe carer profile moves across organizations.
- Adds `organization_id` to audit logs, consent records, erasure queue entries, and medication audit records.
- Scopes GDPR SAR, erasure, and consent service operations by organization.
- Converts medication administration updates to tenant-scoped update-and-read primitives.
- Adds focused regression tests for membership resolution, cross-org carer move blocking, and tenant-scoped GDPR operations.

## What Remains Blocked

- Sensitive nullable `organization_id` columns still require a production-safe backfill and NOT NULL migration.
- `Carer` is still a global profile keyed by auth subject, so true multi-organization staff profiles need a later membership-aware staff profile design.
- Legacy global uniqueness remains on `Carer.email`, `FamilyContact.auth_subject`, and `OrganizationIdentity`.
- Clerk is repo-wired for API token validation and explicit membership lookup, but live Clerk dashboard/session QA is still blocked:
  - Clerk `org_id` maps to `Organization.id` or `OrganizationMembership.external_organization_id`.
  - Clerk user subject maps to `OrganizationMembership.auth_subject`.
  - Clerk organization role maps to `OrganizationMembership.role`.
  - Clerk membership status maps to `OrganizationMembership.status`.
- Tenant-scoped backup, restore, customer export, deletion/offboarding, and support break-glass controls still need implementation and testing.
- Authenticated two-tenant browser QA remains required before any external-company pilot.

## Pilot Boundary

Internal Oasis pilot work can continue with local/internal auth paths.

External-company SaaS use remains blocked until:

- explicit membership is populated for every production user,
- tenant membership is required in production,
- nullable tenant ownership has been backfilled and constrained,
- GDPR and audit exports are tenant-safe,
- two-tenant P0 regression tests are green,
- provider DPA, HTTPS, backup/restore, and authenticated CareBridge boundary checks are complete.
