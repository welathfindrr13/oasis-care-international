# Manager navigation, terminology, and authority

## Role, context, and single job

- **Role:** Manager with the authoritative `TENANT_ADMIN` capability.
- **Context:** Daily organisation administration across desktop, tablet, and mobile layouts.
- **Single job:** Find the client or operational area needed, keep the selected client in context, and complete management work without encountering developer identifiers, duplicate names, or misleading report links.

Manager-facing copy deliberately uses **Clients**. This is a conscious research-backed product override of the repository's default person-centred content principle. Carer and Family surfaces continue to use the person's name or “person you support.”

## Primary action and decision information

The primary action on the client list is **Add client**. Before acting, a Manager needs:

- the client's name and usable address;
- last and next visit information;
- a clear route to the client record;
- client-scoped routes for scheduling, Family access, care planning, and inspection records.

Internal UUIDs, source-record language, fake tab distinctions, and global document links do not help that decision and are removed.

## Content outline

Primary navigation:

1. Today
2. Clients
3. Schedule
4. Workforce
5. Family updates
6. Care planning
7. Inspection records
8. Settings

Client record:

1. Client identity and usable contact/address information.
2. Operational summary.
3. Visits and Care Notes.
4. Client-scoped management actions.

Settings:

1. Profile and session details.
2. Operational shortcuts.
3. Secondary **Service monitoring** link for authorised Managers.

## Text wireframe

### Clients

```text
[H1] Clients
View each client's care status, visits, Care Notes, and Family access.

Clients supported: [count]
[Search clients]                         [Add client]

Client | Address | Last visit | Next visit | Actions
[name] | [address] | [date] | [date] | View · Edit · Schedule
```

### Client details

```text
[Back to Clients]
[H1] [Client name]
Client details

[summary information]

[H2] Client actions
Schedule visit
Family access
Care planning
Inspection records
Edit client
```

### Settings

```text
[H1] Settings

[H2] Operational shortcuts
Today · Schedule · Clients · Family updates · Workforce

[H2] Service monitoring
Open service monitoring
Operational health information is separate from client inspection records.
```

## Existing tokens and components

- Reuse `Header`, `Button`, `Card`, `StatePanel`, route-resolution helpers, and existing Oasis typography/colour tokens.
- Keep the existing flat slate/teal operational visual language.
- Preserve compatible aliases at `/people`, `/clients`, `/reports`, and `/evidence`.
- Use existing server-auth and capability helpers for the care-planning page gate.

No new design system, decorative component family, data model, or GraphQL type is introduced.

## Removals and consolidation

- Remove visible UUID fragments and “source record” wording.
- Replace three fake Care Plan/Assessments/Risks links to one real **Care planning** link.
- Remove the misleading global Documents link.
- Remove `/admin/metrics` as an Inspection records/Reports alias.
- Move Service monitoring to a secondary Settings link.
- Do not rename database models, GraphQL types, or stored fields.
- Do not redesign the Care planning or Inspection records page bodies in this PR; that is the later focused workflow PR.

## Responsive behaviour

- **1440×900:** full primary navigation and data table with clear row actions.
- **768×1024:** navigation can use the existing compact treatment; actions wrap without obscuring the client context.
- **390×844:** client rows remain readable using the existing responsive list/table behaviour; the primary Add client action stays visible.
- **320 CSS pixels:** no horizontal page scroll; long fictional client names and addresses wrap; 44px minimum interactive targets remain available.

## State matrix

| State                | Expected presentation                                               |
| -------------------- | ------------------------------------------------------------------- |
| Loading              | Existing route-level loading state; no fake metrics                 |
| Empty                | “No clients yet” with one Add client action                         |
| Validation           | Linked field errors, focus to first invalid field, values preserved |
| Success              | Existing truthful live confirmation                                 |
| Unavailable          | `StatePanel` with alert semantics and working retry                 |
| Forbidden            | Safe access-state redirect without leaking client existence         |
| Stale/missing client | Existing not-found or safe unavailable state                        |
| Alias route          | Same canonical content and active navigation item                   |
| No client context    | Care planning/inspection page supplies an explicit client chooser   |

## Accessibility review

- One clear `h1` per page with ordered headings.
- Existing landmarks and skip link remain intact.
- Navigation active state works for canonical and alias routes.
- All new links and actions retain visible focus and at least 44px targets.
- Page-level care-planning denial occurs before care data is queried.
- Errors remain linked to controls and values remain preserved.
- Long labels and fictional names reflow at 320 CSS pixels.
- Service monitoring is named as operational health, not a care report.

## Anti-slop critique

- No gradient hero, oversized title, decorative pill wall, or new dashboard metric is added.
- Navigation labels use one plain operational name per concept.
- The client record avoids a card for every field and removes developer metadata.
- Care planning and Inspection records stay distinct because they support different Manager decisions.
- The primary navigation is intentionally long but task-based; Service monitoring remains secondary because it is not part of routine client work.
- The scope resists redesigning the later care-planning workflows before their dedicated PR.
