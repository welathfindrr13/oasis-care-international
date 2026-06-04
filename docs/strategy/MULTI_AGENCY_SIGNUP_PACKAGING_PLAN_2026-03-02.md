# Oasis Care Multi-Agency Signup, Packaging, and Monetization Plan

Date: 2026-03-02
Owner: Founder + Product + Engineering
Status: Proposed implementation blueprint based on current codebase state

## 1) Executive Summary

You already have partial multi-tenant foundations:
- `organization_id` exists on core records.
- Auth can resolve org context from token claims or identity map.
- Most service queries are org-scoped.

You do not yet have a complete commercial SaaS engine:
- No package catalog.
- No subscriptions or billing workflow.
- No self-serve org signup/provisioning journey.
- No hard entitlement enforcement layer.

Recommended commercial model now:
- Keep one shared SaaS platform for most agencies.
- Sell monthly packages per organization.
- Add optional metered AI and analytics add-ons.
- Offer dedicated environment only for enterprise agencies.

## 2) Current-State Findings (From This Repo)

### 2.1 Multi-org data model exists, but not hardened

Source: `libs/db/prisma/schema.prisma`
- `Organization` and `OrganizationIdentity` models exist.
- Core records include nullable `organization_id`:
  - `carer`, `client`, `visit`, `carer_shift`, `care_log`.
- `Organization.ai_summary_enabled` exists.

Risk:
- Nullable org foreign keys make data isolation weaker than it should be for scale.

### 2.2 Org context is inferred in multiple places

Source: `libs/auth/src/jwt.strategy.ts`, `apps/api/src/auth/api-roles.guard.ts`
- JWT accepts org claims (`custom:organization_id`, `organization_id`, `org_id`, `tenant_id`).
- Guard enriches missing org context via:
  - `organization_identity` map,
  - fallback lookup via `carer`.

Risk:
- Implicit org resolution can become ambiguous as more agencies/users are added.

### 2.3 Service-level org fallback still exists

Source examples:
- `apps/api/src/client/client.service.ts`
- `apps/api/src/visit/visit.service.ts`
- `apps/api/src/care-log/care-log.service.ts`
- `apps/api/src/ai-summary/ai-summary.service.ts`
- `apps/api/src/stats/stats.service.ts`

Pattern:
- If `organizationId` missing and only one org exists, service falls back to that org.
- In true multi-agency production, this is unsafe behavior and should be removed.

### 2.4 No billing or package layer yet

Repo-wide search result:
- No Stripe/subscription/invoice/entitlement runtime in app code.
- No package plan model in Prisma.
- No org billing/admin pages.

### 2.5 Provisioning UX is operationally manual

Source: `apps/web/app/admin/carers/page.tsx`
- Upsert requires direct Cognito `sub` entry by admin.
- This is not a scalable organization onboarding flow.

### 2.6 Infra is currently shared-tenant

Source: `infrastructure/staging/ecs-service.tf`, `infrastructure/staging/rds.tf`
- One API service and one Web service.
- One Postgres DB (`db_name = "oasis"`).

Interpretation:
- Current architecture matches a shared multi-tenant SaaS pattern.
- Enterprise dedicated deployment can be added later as a premium tier.

## 3) Target Business Model (How This Works for You)

### 3.1 Product packaging

Package set (recommended):
1. `Launch` (micro/small agencies)
   - Lowest entry price.
   - Tight caps and self-serve support model.
2. `Starter`
   - Small agency footprint, core operations.
   - Lower caps (clients, carers, AI calls).
3. `Growth`
   - Higher limits, analytics, stronger support SLA.
4. `Scale`
   - High caps, premium analytics, integrations.
5. `Enterprise Dedicated` (add-on deployment model)
   - Single-tenant infra option, advanced compliance controls.

### 3.2 Revenue model

Monthly recurring revenue per organization:
- Base platform fee by package.
- Usage components:
  - active clients band,
  - AI summary usage,
  - optional benchmarking/analytics add-ons.
- Explicit overages to protect margin as usage scales.

Pricing target (undercut + profit model, GBP/month):
1. `Launch`: 99
2. `Starter`: 199
3. `Growth`: 549
4. `Scale`: 1399
5. `Enterprise Dedicated`: from 3999 + setup/onboarding fee

Default included limits:
1. `Launch`: up to 15 active clients, 5 staff, 75 AI summaries/month.
2. `Starter`: up to 50 active clients, 15 staff, 400 AI summaries/month.
3. `Growth`: up to 200 active clients, 60 staff, 2500 AI summaries/month.
4. `Scale`: up to 800 active clients, 200 staff, 12000 AI summaries/month.

Default overages:
1. Active client overage:
   - Launch/Starter: 4.00 per active client/month.
   - Growth: 3.00 per active client/month.
   - Scale: 2.00 per active client/month.
2. AI summary overage:
   - Launch/Starter: 0.08 per summary.
   - Growth: 0.06 per summary.
   - Scale: 0.05 per summary.
3. Additional staff seats:
   - Launch: 8 per staff/month.
   - Starter: 6 per staff/month.
   - Growth: 5 per staff/month.
   - Scale: 4 per staff/month.

Guardrails for profitability:
1. Launch includes email/chat support only.
2. Phone support starts at Growth.
3. Annual discount capped at 10%.
4. AI overage always metered; no unlimited AI on sub-Scale plans.
5. Keep blended gross margin target >= 75%.

### 3.3 What you sell vs what you do not sell

Sell:
- Platform access.
- Insights products.
- Aggregate benchmarking with strict controls.

Do not sell:
- Raw row-level identifiable care records.
- Direct free-text extracts with re-identification risk.

## 4) Target Technical Architecture

### 4.1 Tenant strategy

Default:
- Shared app + shared DB, strict row-level tenant scoping (`organization_id`).

Premium:
- Dedicated stack (separate DB/ECS) for enterprise agencies.

Why:
- Shared gives best margin and speed.
- Dedicated provides higher-contract-value option.

### 4.2 Hard tenant enforcement model

Layer 1: Identity and session
- Every authenticated request must resolve exactly one organization.
- No "single-org fallback" behavior in production mode.

Layer 2: API authorization
- Every service method requires explicit `organizationId`.
- All repository queries include tenant filter.

Layer 3: Data constraints
- Convert tenant FK fields to non-null where feasible after migration.
- Add defensive DB constraints and indexes for tenant access patterns.

Optional Layer 4 (Phase 2 hardening):
- PostgreSQL Row Level Security policies by org claim.

## 5) Data Model Additions Needed for Commercial SaaS

Add these Prisma models:
1. `Plan`
   - id, code, name, monthly_price, currency, billing_interval, is_active.
2. `PlanEntitlement`
   - feature_key, limit_value, metered flag by plan.
3. `OrganizationSubscription`
   - organization_id, plan_id, status, current_period_start/end, trial_end, cancel_at_period_end.
4. `BillingCustomer`
   - organization_id, provider (`stripe`), external_customer_id.
5. `BillingSubscription`
   - organization_id, external_subscription_id, price_id, status.
6. `UsageMeter`
   - organization_id, metric_key, period_start/end, quantity.
7. `InvoiceRecord`
   - organization_id, external_invoice_id, amount_due, amount_paid, status, hosted_invoice_url.
8. `FeatureFlagPolicy`
   - organization_id, feature_key, enabled, source (`plan`, `override`, `trial`).

Add constraints:
- Unique active subscription per org.
- Unique billing customer per org/provider.
- Indexes on `(organization_id, status)` and period windows.

## 6) Signup and Provisioning Journeys

### 6.1 Sales-assisted onboarding (first release)

Flow:
1. Internal admin creates organization.
2. System creates default subscription state (trial or draft).
3. Invite first org admin user.
4. Org admin signs in via Cognito.
5. Identity map links Cognito identity to organization.
6. Setup wizard: timezone, service area, staff invites, first client import.

### 6.2 Self-serve onboarding (phase 2)

Flow:
1. Agency enters company details and owner email.
2. Pick package and payment method.
3. Payment success triggers provisioning webhook.
4. Org and owner role auto-created.
5. User lands in setup wizard.

### 6.3 Provisioning contract

Provisioning must be idempotent:
- Keyed by `organization_id` and `external_subscription_id`.
- Retries safe on webhook duplicate delivery.

## 7) Entitlement Enforcement Design

Create a centralized entitlement service in API:
- `canUse(orgId, featureKey) -> boolean`
- `assertLimit(orgId, metricKey, incrementBy) -> allow|deny`

Apply to:
1. AI summary generation.
2. Client count limits.
3. Carer seat/user limits.
4. Advanced analytics and exports.

UI behavior:
- Disable unavailable actions.
- Show clear "upgrade package" paths.

## 8) Authentication and Org Context Changes

### 8.1 Required changes

1. Remove production fallback to "first/only org" from service layers.
2. Require explicit org context in request user object for all guarded routes.
3. Expand `organization_identity` usage for deterministic mapping only.
4. Add explicit "org selection" only if a user can belong to multiple orgs.

### 8.2 Cognito strategy

Preferred:
- Add org identifier in token claim at auth time.

If claim unavailable:
- Resolve through signed mapping table only.
- Reject ambiguous identity mappings.

## 9) Buyer-Facing Package Definition (Example)

### Launch (small agencies)
- 99/month.
- Up to 15 active clients and 5 staff.
- Core visits + care logs + eMAR.
- 75 AI summaries/month.
- Email/chat support only.

### Starter
- 199/month.
- Up to 50 active clients and 15 staff.
- Core operations + PWA.
- 400 AI summaries/month.
- Basic analytics.

### Growth
- 549/month.
- Up to 200 active clients and 60 staff.
- Monthly analytics and operational benchmark pack.
- 2500 AI summaries/month.
- Priority support.

### Scale
- 1399/month.
- Up to 800 active clients and 200 staff.
- Advanced analytics.
- Integration hooks/API access.
- 12000 AI summaries/month.
- Faster support SLA.

### Enterprise Dedicated Add-on
- From 3999/month plus setup fee.
- Dedicated DB and compute.
- Custom compliance controls.
- Custom contract and onboarding.

## 10) Operations Model for You

### 10.1 Sales to activation

1. Lead qualifies.
2. Package selected.
3. Contract + DPA accepted.
4. Org provisioned.
5. Go-live checklist complete.

### 10.2 Monthly management

1. Automated billing and receipts.
2. Dunning flow for failed payment.
3. Usage reporting for upsell opportunities.
4. Churn flags:
   - drop in weekly active carers,
   - drop in care-log completion.

### 10.3 Offboarding

1. Subscription cancellation policy.
2. Data export window.
3. Retention and deletion workflow by policy.
4. Audit trail maintained.

## 11) Compliance Controls Needed Before Monetization Expansion

1. Data minimization for AI prompts:
   - avoid direct identifiers.
2. Prompt/response redaction and logging policy.
3. Cross-tenant analytics only from de-identified aggregates.
4. Tenant-level secondary-use policy flags.
5. DPIA and contract terms for benchmarking/research products.

## 12) Implementation Plan (Phased)

## Phase 0: Decision Lock (March 2-3, 2026)
1. Approve package catalog (Launch/Starter/Growth/Scale/Enterprise Dedicated).
2. Approve pricing and overage policy.
3. Confirm billing provider (Stripe recommended).
4. Confirm enterprise dedicated deployment policy.

## Phase 1: Tenant Hardening (March 4-7, 2026)
1. Remove org fallback behavior across services.
2. Require explicit org context across guarded APIs.
3. Add migration to tighten nullable org fields where safe.
4. Add automated tests for cross-tenant access denial.

## Phase 2: Billing and Entitlements (March 8-14, 2026)
1. Add billing and subscription models.
2. Implement webhook-driven subscription state sync.
3. Implement central entitlements checks.
4. Add org usage meters.

## Phase 3: Onboarding UX (March 15-21, 2026)
1. Add org admin onboarding pages.
2. Add invite flows for staff users.
3. Replace manual `sub` entry UX for carers with guided provisioning flow.
4. Add package/usage visibility in admin settings.

## Phase 4: Commercial Launch Readiness (March 22-28, 2026)
1. Add invoice and billing status views.
2. Add cancellation/dunning rules.
3. Add support runbooks.
4. Run pilot with 1-2 agencies.

## 13) Engineering Backlog (File-Oriented)

### Core API
1. Add `apps/api/src/billing` module (new).
2. Add `apps/api/src/entitlements` module (new).
3. Update org resolution and enforcement:
   - `apps/api/src/auth/api-roles.guard.ts`
   - `apps/api/src/*/*.service.ts` where `requireOrganizationId` fallback exists.

### DB
1. Extend `libs/db/prisma/schema.prisma` with billing/plan/entitlement models.
2. Add migrations under `libs/db/prisma/migrations/*`.
3. Add seed script for default plans.

### Web
1. Add onboarding routes:
   - `apps/web/app/onboarding/*`
2. Add org settings and billing routes:
   - `apps/web/app/settings/billing/*`
   - `apps/web/app/settings/organization/*`
3. Replace manual carer upsert UX:
   - `apps/web/app/admin/carers/page.tsx`

### Infra/Secrets
1. Add billing webhook secret and environment variables to task defs:
   - `infrastructure/staging/ecs-service.tf`
2. Add staged config for pricing IDs and feature flags.

## 14) Testing and Launch Gates

Required gates before multi-agency commercial launch:
1. Tenant isolation tests:
   - zero cross-org data leaks in API and UI.
2. Subscription lifecycle tests:
   - trial to active, active to past_due, cancellation behavior.
3. Entitlement tests:
   - package limits correctly enforced.
4. Billing webhook idempotency tests.
5. Recovery tests:
   - billing provider outage fallback behavior.
6. Auditability:
   - who changed plan/features and when.

## 15) Risks and Mitigations

1. Risk: Ambiguous org mapping for users.
   - Mitigation: strict identity map constraints and explicit error flows.
2. Risk: Shared-tenant leakage due missing filter.
   - Mitigation: code tests + optional RLS + query lint checks.
3. Risk: Billing drift from webhook failure.
   - Mitigation: reconciliation job + idempotent events table.
4. Risk: Support burden during onboarding.
   - Mitigation: guided wizard + checklists + onboarding playbook.

## 16) KPI Framework for You

Commercial KPIs:
1. MRR.
2. Active organizations.
3. Net revenue retention.
4. Churn rate.

Product KPIs:
1. Weekly active carers per org.
2. Care-log completion rate.
3. AI summary utilization rate.
4. Time-to-first-value after signup.

Ops KPIs:
1. P1/P2 incident count per month.
2. Staging and production gate pass rates.
3. Mean time to resolve.

## 17) Immediate Next 10 Actions

1. Lock package names, limits, and headline prices.
2. Confirm billing provider and webhook architecture.
3. Approve strict org-context policy (remove fallback behavior).
4. Create Prisma schema draft for plans/subscriptions/entitlements.
5. Build API entitlement middleware/service.
6. Add org admin billing/settings pages in web app.
7. Replace manual carer `sub` process with invite/provision flow.
8. Add tenant isolation regression test suite.
9. Add billing status and dunning notifications.
10. Pilot with one real agency and run a 2-week readiness report.

## 18) Final Recommendation

For the next commercial release:
1. Ship shared multi-tenant SaaS with strict tenant hardening.
2. Launch Starter/Growth/Scale packages with monthly billing.
3. Keep enterprise dedicated environment as high-ticket add-on.
4. Treat AI and analytics as monetizable add-ons with explicit entitlements.

This gives you fast revenue, controlled engineering scope, and a clear upgrade path.
