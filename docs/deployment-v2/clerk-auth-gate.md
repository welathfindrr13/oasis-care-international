# Clerk Auth Gate

This repo is Clerk-ready at the code boundary, but it is not production-auth approved until a real Clerk dashboard and authenticated staff/family sessions are tested with fake data.

## Required Organization Mapping

- Clerk `org_id` maps to `Organization.id` or an approved external organization mapping.
- Clerk user `sub` maps to `OrganizationMembership.auth_subject`.
- Clerk organization role maps to the tenant-scoped `OrganizationMembership.role`.
- Clerk membership state maps to `OrganizationMembership.status`.
- Email is display/contact metadata only and must not authorize tenant membership.

## Required Token Claims

The backend requires an auth subject, active organization id, tenant-scoped role, and active membership. Browser/API calls must carry a bearer token for the active Clerk organization. Clerk's default `org:member` role and all token-derived roles are untrusted context only. API `@Roles` checks run after the active `OrganizationMembership` is loaded, and the verified membership role is authoritative.

The web uses a shared Clerk-compatible server auth context for server pages, admin layouts, GraphQL requests, dashboard stats, and evidence-pack export. Web route and navigation decisions remain presentation controls only; the API membership guard is the authorization boundary.

## Remaining Session Migration Gaps

- Client components still using NextAuth `useSession()` must migrate to a shared Clerk-compatible client session before staff/family runtime QA can be considered complete. Current gaps include the header/navigation, visit workspace, medication round, shift, settings, person care notes/summary, and delete-person control.
- A Clerk user with only the default `org:member` role is intentionally not treated as Oasis staff by web route/navigation controls. Staff smoke testing requires an explicit non-default staff role claim or a future verified-membership web context bridge.
- Until those client paths are migrated and real admin/staff/family sessions are tested, Issue #10 remains incomplete and real client data remains blocked.

## Runtime QA Still Required

- Staff/admin Clerk session can access staff routes and GraphQL operations.
- Family Clerk session can access only the Family Assurance Hub.
- Family cannot access raw visits, care logs, medication names/doses/advice, care planning, evidence packs, approval queues, staff, reports, or admin pages.
- CareBridge published-only behavior is proven with fake/non-client data.
- Organization switching updates the active tenant context before GraphQL requests.

Keyless or synthetic Clerk values are local/preflight conveniences only. They are not production proof and must not be used with real client data.
