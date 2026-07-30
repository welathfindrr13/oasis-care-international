# Client archive and company-access closure

## User, context and single job

The Manager is retiring a client from active care delivery. Their single job is
to remove that client and their visits from operational work while ending the
client-specific Family access immediately and preserving historical records.

An authenticated person without an active Oasis company membership has a
separate single job: understand why no workspace can open and use the governed
company-request or invitation route without loading care information.

## Decision and primary action

On Client details, the consequential action is **Archive client**. Before
confirming, the Manager needs the client name and four consequences:

- the client and visits leave active operational views;
- Family access for this client ends immediately;
- historical records remain;
- a replacement client needs separate CareBridge setup and permissions.

The confirmation has one destructive action, **Archive client**, and one
secondary action, **Cancel**.

On the unaffiliated access surface, the primary action remains **Request company
access**. The person can instead recover an approved invitation or choose a
different account. Clerk organisation membership is only a candidate; Oasis
revalidates internal company membership before opening a workspace.

## Content outline

- Client details:
  - existing client summary and operational links;
  - secondary destructive action: **Archive client**;
  - exact-name confirmation;
  - plain consequences, without IDs or deletion claims;
  - announced failure on the retained page;
  - announced success on Clients.
- Company access:
  - **Company access is not ready**;
  - no care information loaded;
  - request company access;
  - approved-invitation recovery;
  - Clerk membership candidates followed by Oasis `/access` revalidation;
  - different-account recovery.

## Text wireframes

```text
Client details
  Client name
  Active client actions
  [Archive client]

  dialog: Archive [client name]?
    The client and visits will leave active work.
    Family access for this client ends immediately.
    Historical records remain.
    Replacement clients need separate setup and permissions.
    [Cancel] [Archive client]

  failure
    alert: Client could not be archived. No access change is claimed.

Clients
  status: [client name] was archived. Visits and Family access were removed.
  current active-client list

Observed Clerk fallback: /login/tasks
  redirect to /session-tasks/choose-organization

Company access is not ready
  explanation and no-care-data boundary
  [Request company access]
  approved invitation recovery
  company candidates
    [Continue] -> activate Clerk candidate -> /access -> internal revalidation
  [Use a different account]
```

On narrow screens, dialog content, consequences and actions remain in source
order. Actions stack without horizontal scrolling. The company-access page
keeps its existing single-column mobile order.

## Visual direction and compact tokens

The direction is calm operational closure: flat Oasis surfaces, restrained
borders, plain consequences and one clearly labelled destructive action. The
access route keeps the established calm company-access presentation. Neither
flow introduces a hero, dashboard, metric, decorative pill, gradient or new
visual language.

- canvas and surfaces: existing `oasis-canvas` and `oasis-surface`;
- text: existing `oasis-ink` and `oasis-muted`;
- boundaries: existing `oasis-border`;
- primary and focus treatments: existing Oasis button and focus tokens;
- destructive confirmation: existing `ConfirmDialog` danger treatment;
- errors and status: existing alert/status semantics.

## Reused and changed foundations

The implementation reuses `ConfirmDialog`, the existing Button component,
Manager Client details, the Clients list, `ClerkProvider.taskUrls`, the governed
choose-organisation page and `/access` membership revalidation.

The internal GraphQL operation remains `deleteClient` for compatibility; only
Manager-facing language changes to **Archive client**. No data model, route
authority, provider-authority mapping or Clerk organisation-creation behaviour
changes.

## Removals and consolidation

- remove native browser `confirm()`;
- remove misleading soft-delete wording from customer-facing copy;
- remove the generic Clerk `/login/tasks` dead end by redirecting it to the
  governed task page;
- do not add a second access screen or duplicate confirmation component;
- do not expose internal IDs, invitation tokens or audit metadata.

## Responsive behaviour

- 320 CSS pixels: one reading column, wrapping name and consequences, actions at
  least 44px high, no horizontal scroll;
- 390×844: confirmation fits without obscuring focus or the actions;
- 768×1024: restrained dialog width and unchanged access-page reading order;
- 1440×900: no expansion into a dashboard or oversized modal;
- 200% zoom and long fictional names: content wraps without clipping;
- reduced motion: no new animation is added.

## State matrix

| Surface | State | User-facing result |
| --- | --- | --- |
| Client details | ready | **Archive client** is available to an authorised Manager |
| Archive dialog | opened | Exact client name and all four consequences |
| Archive dialog | cancel | No mutation; focus returns to **Archive client** |
| Archive dialog | submitting | Confirm action disabled; exactly one mutation in flight |
| Archive dialog | failure | Announced alert; page and context retained |
| Archive dialog | success | Redirect to Clients with an announced archive result |
| Archive lifecycle | repeated/concurrent | Idempotent result; no second authority transition |
| Family old room | next request | Same non-disclosing denial as an unknown room |
| Replacement client | no setup | No inherited room, membership or grant |
| `/login/tasks` | observed Clerk fallback | Redirect to governed choose-organisation task |
| Choose organisation | loading | Existing loading state; no care data |
| Choose organisation | no candidates | Request/invitation recovery guidance |
| Choose organisation | candidates | Candidate list only; `/access` revalidates Oasis membership |
| Choose organisation | invalid/old candidate | Calm no-membership or mismatch state |
| Back/refresh/account switch | unaffiliated | No cached client, room or company information |

## Accessibility checks

- one informative `h1` and ordered headings on each route;
- native dialog semantics through `ConfirmDialog`;
- focus moves into the confirmation and returns to the opener on cancel;
- confirm is guarded against repeated activation;
- failure uses an alert; success uses a polite live status;
- buttons and links are keyboard operable and at least 44px;
- status meaning does not depend on colour;
- long client names and guidance reflow without horizontal scrolling;
- zero-allowlist Axe A/AA checks at 390×844, 768×1024 and 1440×900;
- explicit keyboard, focus, 320px reflow and reduced-motion checks.

Automated checks do not prove full WCAG 2.2 AA conformance or replace testing
with Managers and unaffiliated users.

## Pre-implementation anti-slop critique

The confirmation exists because this action removes active care work and
client-specific Family authority, not because every destructive action needs a
large modal. The four consequences are decision information, not reassurance or
marketing copy. The safe access page already explains the governed boundary, so
the compatibility route redirects there instead of creating another branded
error surface.

The main risks are implying historical erasure, revoking a Family account's
whole-company membership, treating Clerk organisation membership as Oasis
authority, or adding a visually loud warning that obscures the decision. The
implementation must preserve historical records and shared-account access,
revalidate internal membership, use the existing dialog and keep the copy
plain.
