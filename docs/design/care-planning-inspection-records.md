# Care planning and inspection records

## Role, context, and single jobs

Both pages are for a Manager with the authoritative `TENANT_ADMIN` capability and an exact selected client.

- **Care planning:** review assessments and identified risks, then create, complete, activate, supersede, or archive the selected client's care-plan records.
- **Inspection records:** choose a period and permitted record types, create a draft record for inspection preparation, and download an existing record without exposing raw Family content, internal notes, actor details, or identifiers.

These are separate jobs. Creating an inspection record must not compete with decisions about assessment completion or care-plan activation.

## Primary actions and decision information

### Care planning

The primary action is **Create care plan draft**. Before acting, a Manager needs:

- the selected client's name;
- available assessments and their state;
- identified-risk counts and review dates;
- existing care-plan versions, state, effective dates, and review dates;
- clear warnings before completing an assessment or activating or archiving a plan.

### Inspection records

The primary action is **Create inspection record**. Before acting, a Manager needs:

- the selected client's name;
- the period covered;
- the permitted record types available in that period;
- the records selected;
- existing inspection records, their state, period, included record types, and download action.

## Content outline

### Care planning

1. `h1`: Care planning.
2. Purpose: manage assessments and care-plan versions for the selected client.
3. Client chooser preserving `clientId`.
4. Assessments and identified risks.
5. Create assessment.
6. Care-plan versions.
7. Create care-plan draft.
8. Review actions: complete assessment, activate care plan, archive care plan.
9. Loading, empty, unavailable, and forbidden states.

### Inspection records

1. `h1`: Inspection records.
2. Purpose and disclaimer: records support inspection preparation but do not guarantee an outcome.
3. Client chooser preserving `clientId`.
4. Existing records with covered period, included record types, state, and download action.
5. Create inspection record: period, optional linked care plan, permitted source selection.
6. Loading, empty, validation, unavailable, and forbidden states.

## Text wireframes

### Care planning

```text
[H1] Care planning
Manage assessments and care-plan versions for [client].

[Choose client]

[H2] Assessments and identified risks
[assessment title] [state]
Summary · findings count · risks count · review date
[Create assessment form]

[H2] Care plans
[plan title] [version] [state]
Effective date · review date · safety notes
[Create care plan draft form]

[H2] Review care planning
[Complete assessment] [Activate care plan] [Archive care plan]
Each consequential action names the selected record before one mutation.
```

### Inspection records

```text
[H1] Inspection records
Prepare records for [client]. These records support inspection preparation
but do not guarantee an outcome.

[Choose client]

[H2] Existing inspection records
[state] [covered period]
Included: Visits 2 · Care notes 1 · Assessments 1
[Download]

[H2] Create inspection record
Period start
Period end
Linked care plan (optional)
Include assessments
Include care plans
Include visits, care notes, and concerns
[Create inspection record]
```

On narrow screens, sections remain in reading order and actions become full width. Existing-record metadata wraps rather than creating horizontal scrolling.

## Visual direction and compact tokens

The direction is a calm, document-led care administration workspace:

- **Primary ink:** `text-oasis-ink` for headings and decisions.
- **Secondary ink:** `text-oasis-muted` for explanations and dates.
- **Primary surface:** white for forms and record lists.
- **Secondary surface:** `bg-base-gray-50` for supporting groups.
- **Action:** `bg-oasis-teal` for the one primary action.
- **Attention:** Oasis attention/danger/success tokens for meaningful state and errors.

Typography uses the existing sans and heading roles, with a readable text measure and normal sentence case. Layout uses one content column with bordered sections rather than a hero, metric wall, or card grid.

The useful signature detail is a compact **Included records** summary on every inspection record. It gives the Manager an immediate, safe inventory by record type without exposing raw record content.

## Existing foundations

Reuse:

- `Header` and its existing skip-link/navigation behaviour;
- `Button`, `Alert`, `FieldError`, `StatePanel`, and `StatusLabel`;
- existing Oasis tokens in `tokens.css`;
- existing client chooser and exact `clientId` context;
- existing assessment, care-plan, evidence-pack mutations, versioning, audit, and confirmation behaviour;
- existing server authentication and capability helpers.

Add:

- a pure inspection-record projection helper because the current evidence UI and PDF serialize raw and internal fields;
- a focused `InspectionRecordActions` component because inspection-record creation is a separate Manager job;
- a narrow inspection-source picker because the existing picker presents raw operational preview and actor content.

No new token family, API operation, database model, schema migration, status, or permission is introduced.

## Removals and consolidation

- Remove evidence-pack creation from Care planning.
- Remove assessment and care-plan creation/lifecycle actions from Inspection records.
- Remove “Assess, Plan, Prove”, “proof-led”, “source-linked”, “evidence dashboard”, and compliance-sounding claims.
- Remove gradients, oversized heroes, metric walls, decorative pills, excessive cards, and marketing copy.
- Remove arbitrary inspection-record kind, invented summaries, source references, and manual-note records.
- Stop inventing assessment findings and care-plan goals or interventions that the Manager did not enter.
- Remove raw source titles, descriptions, care notes, Family content, actors, and identifiers from the picker, page, and PDF.
- Keep historical stored records unchanged; safe queries and projections simply do not select or render restricted fields.

## Responsive behaviour

- **1440×900:** one readable content column with side-by-side form fields only where labels and values remain clear.
- **768×1024:** sections stack; action groups wrap; selected-client context remains visible.
- **390×844:** all fields and actions are full width; lists use stacked metadata; no table or modal causes horizontal scroll.
- **320 CSS pixels:** long client and record names wrap; interactive controls remain at least 44px; status and record counts do not depend on position.
- Text resizing and 400% zoom preserve reading and focus order.
- No motion is added; reduced-motion behaviour therefore remains unchanged.

## State matrix

| State | Care planning | Inspection records |
| --- | --- | --- |
| Loading | Existing route loading, no fake totals | Existing route loading and source-picker status |
| Empty | Explain that no assessment or plan exists and show the relevant create action | Explain that no inspection record exists and show Create inspection record |
| Validation | Linked errors, focusable controls, values preserved | Period and source errors linked to controls, values preserved |
| Success | Live confirmation uses the same action verb | Live confirmation then refreshes the exact client context |
| Unavailable | `StatePanel` alert; no empty-data claim | `StatePanel` alert; no download or create action |
| Forbidden | Safe redirect before client queries | Safe redirect before client or pack queries and exports |
| Stale or missing client | Safe unavailable state preserving the requested context | Same safe unavailable state |
| Partial source data | No invented assessment or plan content | Do not create until source selection loads successfully |
| Offline | Explain that saving or downloading needs a connection | Explain that creating or downloading needs a connection |

## Accessibility review

- One informative `h1` and ordered `h2`/`h3` headings per page.
- Existing header landmark and skip link remain.
- Every field has a visible associated label; related source choices use `fieldset` and `legend`.
- Validation messages use `FieldError`, are referenced by `aria-describedby`, and preserve entered values.
- Loading and success use polite live regions; unavailable and failure states use alert semantics.
- Consequential action cancellation preserves the existing no-mutation behaviour and focus remains on the initiating control.
- Buttons, checkboxes, links, and selects meet the 44px Oasis target.
- Status uses text and icon as well as colour.
- Client names, long record names, and messages reflow at 320 CSS pixels.
- The export is text-based, has no raster text, and contains no internal identifiers.

## Plan anti-slop critique

- The two pages are separated by Manager job, not by implementation model.
- There is one primary action per page instead of a three-column action dashboard.
- The client and the decision-relevant record state appear before secondary detail.
- The design uses a document/list hierarchy instead of generic metric cards.
- The included-record summary is useful for inspection preparation and cannot become a compliance badge.
- The plan removes one entire competing workflow from each page and does not replace it with decoration.
- The language is specific to care planning and inspection preparation while avoiding unsupported assurance or outcomes.
- Historical raw fields remain stored but cannot leak through the new narrow queries or safe projections.

## Result critique after implementation

- Each page now opens with the selected client, one short explanation, and one
  workflow-specific action. Care planning contains assessment and plan work;
  Inspection records contains pack creation and download.
- Source inspection and executable projection tests confirm that no gradient,
  metric wall, decorative pill set, invented care content, raw Family content,
  operational note, actor, or visible internal identifier remains.
- Page-order and export-handler tests confirm `TENANT_ADMIN` authority is
  checked before client, pack, rendering, or audit work.
- GraphQL AST tests and export tests confirm that source selection and PDF
  output contain only permitted type, status, period, timestamp, and count
  information.
- The repeated top-of-page “what this means” panel was removed. A single
  sentence beneath each `h1` now carries the boundary without competing with
  the primary task.
- Static responsive rules, 44px control classes, full affected web tests, and
  the production web build are green. Exact viewport visual inspection remains
  part of the independent PR review gate rather than being claimed from source
  inspection alone.
