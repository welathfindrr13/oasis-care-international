# Oasis role journeys from the current repository

This is a repository audit, not a product wish list. Re-check the routes and data before each redesign because implementation and permissions can change.

## Product surface and access

The web app has role- and capability-aware access. Tenant admins and carers or other frontline-capable memberships use `/today`; manager, care-manager, and office memberships without a frontline capability are restricted to `/settings`; external or family users use `/family`. Admin-only access covers selected create/edit and admin routes. Shared navigation is in `apps/web/components/oasis/Header.tsx`.

Current route aliases create overlapping concepts:

| Current route | Alias or related route | Design implication |
| --- | --- | --- |
| `/today` | `/dashboard` | Today is the tenant-admin and frontline-capable home; dashboard naming is legacy/technical. |
| `/people` | `/clients` | Decide whether the user-facing concept is people, clients, or a role-specific phrase. |
| `/schedule` | `/visits` | Schedule and visit work are related but not identical; do not hide the distinction. |
| `/family-updates` | `/carebridge` | Staff approval and family viewing are different jobs and should not be conflated. |

## Carer journey

The practical loop is:

1. Open Today or My Shift.
2. See assigned visits and what needs attention.
3. Open a visit and confirm the person, time, address, and visit tasks.
4. Start the visit.
5. Record task outcomes and care notes.
6. Handle medication support where due and record exceptions accurately.
7. Raise or escalate a concern when needed.
8. Complete the visit and understand what remains.

Current frontline-accessible routes are `/today`, `/visits`, `/visits/[id]`, `/schedule/[id]`, `/shift`, `/settings`, and person context under `/clients/[id]`. Medication recording is currently reached through an assigned visit; the standalone `/medication` route and `/people/[id]` are not proven frontline destinations. Design priority: fast scanning, readable content on a phone, safe confirmation, minimal duplicate entry, clear offline/error recovery, and no hidden critical action.

## Tenant-admin and manager journey

The current tenant-admin loop is:

1. Understand today’s workload and exceptions.
2. Organise people, carers, visits, and schedules.
3. Review care quality, assessments, and care-plan review dates.
4. Monitor workforce and shift visibility.
5. Review family updates and concern cases.
6. Inspect records or prepare evidence for review.

Relevant routes are `/today`, `/management`, `/people`, `/schedule`, `/staff`, `/admin/carers`, `/admin/analytics`, `/care-planning`, `/family-updates/approvals`, `/family-updates/concerns`, `/evidence`, `/reports`, `/policies`, `/settings`, and `/admin/metrics`. Design priority: decision order, ownership, due dates, exceptions, and traceability—not a wall of metrics or generic dashboard cards.

Manager, care-manager, and office memberships without a frontline capability are currently restricted to `/settings`. Treat a broader manager workspace as unproven until canonical capability and tenant-boundary work supports it; do not infer tenant-admin routes from a manager role label.

## Family journey

The family loop is:

1. Open Family.
2. Choose the care room for the person.
3. Understand approved updates about what happened.
4. See what is next.
5. Notice whether attention is needed and raise or follow a concern where supported.

Relevant routes are `/family`, `/family/care-rooms/[id]`, and the staff-side publishing flow at `/family-updates` and `/carebridge/approvals`. Family users should not see raw care logs, internal handover notes, unapproved content, or unsupported medication detail. Design priority: clarity, calm reassurance without overclaiming, a clear next step, and an understandable route to help.

## Care workflow model

The API and UI support people/client records, scheduled visits, assigned carers, visit tasks and completion, shift clock-in/out, care logs, medication administrations and exceptions, assessments, care plans with approval/archive, evidence packs, family-safe verified visit stories with draft/published/rejected states, and concern cases with messages, ownership, acknowledgement, and resolution.

Do not flatten meaningful states into one generic status. Preserve distinctions such as draft, approved, published, rejected, completed, missed, refused, not required, and concern raised. Do not design a new status badge until the user’s decision and the source-of-truth state are clear.

## Current visual and interaction audit

The repository has generated Figma tokens in `apps/web/styles/tokens.css`, shared `Button` and `Card` components, and a role-aware Header. In practice, pages mix token utilities with raw slate/teal/sky classes, gradients, emoji icons, rounded-full buttons, rounded-2xl/3xl panels, shadows, hover lifts, and bespoke forms. The design foundation should reduce drift rather than add another layer.

The dashboard has route-level loading and error files. Many other routes fetch data directly, collapse failures into empty results, or have no route-level loading state. Existing components include useful focus styles and some ARIA landmarks, but every new or redesigned page needs explicit title, heading, landmark, skip-link, keyboard, focus, error, permission, responsive, and reduced-motion review.
