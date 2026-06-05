# Clerk Auth Gate

This repo is Clerk-ready at the code boundary, but it is not production-auth approved until a real Clerk dashboard and authenticated staff/family sessions are tested with fake data.

## Required Organization Mapping

- Clerk `org_id` maps to `Organization.id` or an approved external organization mapping.
- Clerk user `sub` maps to `OrganizationMembership.auth_subject`.
- Clerk organization role maps to the tenant-scoped `OrganizationMembership.role`.
- Clerk membership state maps to `OrganizationMembership.status`.
- Email is display/contact metadata only and must not authorize tenant membership.

## Required Token Claims

The backend requires an auth subject, active organization id, tenant-scoped role, and active membership. Browser/API calls must carry a bearer token for the active Clerk organization. Clerk's default `org:member` role is not staff-authoritative in the web route guard; Oasis staff/family roles must be supplied through explicit Oasis role claims or verified membership.

## Runtime QA Still Required

- Staff/admin Clerk session can access staff routes and GraphQL operations.
- Family Clerk session can access only the Family Assurance Hub.
- Family cannot access raw visits, care logs, medication names/doses/advice, care planning, evidence packs, approval queues, staff, reports, or admin pages.
- CareBridge published-only behavior is proven with fake/non-client data.
- Organization switching updates the active tenant context before GraphQL requests.

Keyless or synthetic Clerk values are local/preflight conveniences only. They are not production proof and must not be used with real client data.
