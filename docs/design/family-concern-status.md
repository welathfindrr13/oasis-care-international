# Family concern status

## User, context and single job

This page is for an authorised family member who has been given **Send concerns** access for one person. They have already sent, or are about to send, a concern to the care team. Their single job is to understand whether the concern was received and what its current safe status is without seeing internal case handling or another relative's concerns.

## Decision and primary action

The primary action remains **Send concern to the care team**. Before sending, the family member needs the person’s name, the emergency boundary, the concern category and importance, and a short description of what they want the care team to review.

After sending, the main decision is whether they need to wait for the care team or contact the provider through another agreed route. The page therefore shows only the current family-safe status and a short event timeline. It does not expose internal deadlines, priority, assignments, staff identities, private messages, raw care records or another family member’s concerns.

## Content outline

- Page title: the name of the person the family member supports.
- Access explanation: the approved information and actions available in this room.
- Approved updates, when the matching grant is active.
- Concern section:
  - heading: **Tell us about a concern**;
  - 999 emergency warning;
  - category, importance, short summary and optional detail;
  - primary action: **Send concern to the care team**;
  - success: **Your concern has been sent**;
  - history heading: **Your concerns**;
  - current status and submitted date;
  - short timeline of permitted family-safe status events.
- Loading: **Loading your concerns**.
- Empty: **No concerns sent**.
- Unavailable: **Concern statuses are temporarily unavailable** with a real reload action.
- Forbidden or revoked room access: the existing safe, non-enumerating access state.

## Text wireframe

```text
banner
  Oasis Care
  family navigation

main
  breadcrumb: Family home / Person name
  Person name
  Approved family access explanation

  Approved updates
    loading | empty | unavailable | published update list

  Tell us about a concern
    emergency warning: call 999 for immediate danger
    [What is this about?]
    [How important is it?]
    [Short summary]
    [Tell us more (optional)]
    [Send concern to the care team]
    success or linked error

    Your concerns
      loading | empty | unavailable
      concern
        title
        current status
        submitted date and time
        Status history
          Sent — date and time
          Acknowledged — date and time
          Status updated — date and time
          Resolved — date and time
```

On narrow screens, every field, action and concern record remains in one reading column. Status and date wrap beneath the concern title. The timeline uses a simple border and ordered list rather than a decorative horizontal tracker.

## Visual direction and compact tokens

The direction is a calm family communication record: flat white surfaces, restrained borders, readable status text and one simple vertical history rule. It should feel dependable and understandable during an anxious moment, not like a dashboard or case-management tool.

- canvas: `oasis-canvas`;
- surface: `oasis-surface`;
- primary text: `oasis-ink`;
- secondary text: `oasis-muted`;
- primary action: `oasis-teal` / `oasis-teal-dark`;
- boundaries: `oasis-border`;
- warning and error: existing Oasis attention and error roles.

Type uses the existing heading and body families. Status text always includes words; colour is secondary. The signature detail is the short, chronological status list joined by a quiet border so the family member can understand progress without seeing internal workflow.

## Reused and changed foundations

The implementation reuses `Header`, `Button`, `StatePanel`, Oasis tokens, the existing family concern form, the server-authenticated GraphQL client and the current room access projection. The Family page remains server rendered, while the form uses `router.refresh()` inside a transition so a successful submission refreshes the server-owned concern list.

The API adds one dedicated family-safe query rather than reusing the staff concern DTO. That projection contains only an opaque concern identifier, title, current status, submitted timestamp, and permitted event type/timestamp. Existing concern and event tables are unchanged.

No new token, dependency, database field, migration, generic reply model or internal case view is added.

## Removal and scope control

The Family room removes the gradient hero, decorative uppercase pill, oversized rounded surfaces and excess shadow. The concern form no longer replaces the entire form with a success panel; success appears as a live message so **Your concerns** stays visible and another concern can still be sent deliberately.

The family projection removes descriptions, messages, internal deadlines, priority, severity, category, assignments, actor information, metadata, client identifiers and concerns raised by other memberships. Assignment events are not shown. Family-safe care-team replies remain deferred.

Medication/eMAR, care planning, staff notes, operational details and any unapproved content remain outside this surface.

## Responsive and reduced-motion review

- 320px: one column, no horizontal scroll, status/date wrap, all controls at least 44px.
- 390×844: form and history remain readable in source order; no sticky or obscuring action.
- 768×1024: fields may use the existing two-column category/importance row; history remains single column.
- 1440×900: content uses a restrained reading width rather than expanding into a card wall.
- 200% zoom: fields, warning, success and timelines reflow without clipping or two-dimensional scrolling.
- Long person names, concern titles and translated status copy wrap without truncating the decision information.
- No new motion is added. Loading and refresh feedback use text and `aria-live`, including with reduced motion enabled.

## State matrix

| Surface      | State                   | Family-facing result                                                          |
| ------------ | ----------------------- | ----------------------------------------------------------------------------- |
| Room         | authorised              | Person name and only the capabilities approved by the care provider           |
| Room         | forbidden or revoked    | Safe access-unavailable state without confirming that a room or person exists |
| Room         | temporarily unavailable | Alert state with a real reload action                                         |
| Concern form | ready                   | Empty, labelled fields and one primary send action                            |
| Concern form | validation error        | Entered values preserved; linked error focuses the affected control           |
| Concern form | submitting              | Primary action disabled and labelled **Sending…**                             |
| Concern form | success                 | Polite live message, cleared submitted values, and concern-list refresh       |
| Concern form | failure                 | Alert with recovery guidance; entered values preserved                        |
| Concern list | loading or refreshing   | Polite **Loading your concerns** status                                       |
| Concern list | empty                   | **No concerns sent** and guidance to use the form above                       |
| Concern list | populated               | Only concerns raised by this exact membership, newest first                   |
| Concern list | unavailable             | Alert and same-room reload action                                             |
| Concern list | zero grant or revoked   | Server denial; no concern data and no concern form                            |
| Concern list | stale after send        | Refresh remains announced; existing safe records stay visible until replaced  |
| Offline      | action attempted        | Existing request failure message; no offline write or false success           |

## Accessibility checks

- one informative `h1` and ordered `h2`/`h3` headings;
- banner, navigation and main landmarks preserved;
- breadcrumb has an accessible label and current-page state;
- visible associated labels for every field;
- linked validation and failure errors, focusable error summary and preserved entered values;
- success and status refresh announced with `role="status"` and `aria-live="polite"`;
- unavailable and forbidden states use alert semantics through `StatePanel`;
- buttons, links, selects and inputs are keyboard operable and at least 44px high;
- focus remains visible and unobscured after send and reload;
- status meaning does not depend on colour;
- no positive `tabindex`, horizontal overflow or motion that ignores reduced-motion preferences;
- zero-allowlist Axe A/AA checks at 390×844, 768×1024 and 1440×900, plus explicit 320px reflow.

Automated checks do not prove full WCAG 2.2 AA conformance or replace screen-reader and user testing.

## Pre-implementation anti-slop critique

This plan is specific to a family member waiting for a care concern to be handled. The timeline is useful orientation, not a generic activity feed. It has one primary action, no invented metrics, no reply feature without policy, no internal case-management language, and no compliance or response-time claim.

The main risks are accidentally projecting staff-only concern fields, turning statuses into decorative badges, or hiding the history behind a success replacement panel. The implementation must use an explicit narrow database selection, plain status words and a persistent concern list. If the family-safe query cannot prove exact tenant, room and raising membership, it must fail closed rather than render a partial list.

## Verification evidence

- API service, repository and resolver coverage: 56 focused tests passed;
  the complete API unit suite passed 541 tests.
- Web contract, status-label, and StatePanel heading coverage: 157 tests passed.
- Accessibility fixture allowlist: 4 tests passed.
- Full responsive accessibility foundation: 48 browser tests passed across
  390×844, 768×1024 and 1440×900, including explicit 320px reflow.
- API and web production builds passed after generation from the current schema.
- Real-database invitation lifecycle, complete Deployment V2 verification and
  secret scanning remain exact-head CI gates because the local workstation does
  not provide the required disposable Docker runtime.
- Independent read-only review found no P0/P1 isolation or projection issue.
  Its four P2 findings were corrected with neutral status-event wording,
  date-and-time rendering, truthful send confirmation and explicit
  revoked/zero-grant state coverage.

## Final anti-slop critique

Rendered review confirms that **Send concern to the care team** is the only
primary action and the current status is visible beside each concern title. The
room uses flat operational surfaces rather than a marketing dashboard. The 999
warning, safe status history, denial states and retry guidance each answer a
distinct user need; removing any of them would remove emergency guidance,
recovery information or the family member’s safe status record. Internal
messages, staff identities and ornamental status treatments remain absent.
