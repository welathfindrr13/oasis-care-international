# Carer mobile workflow

## User, context and single job

The user is a Carer using Oasis on a phone before and during a working day. They
need to confirm whether they are clocked in, take the correct shift action and
then move into their assigned visits without scanning management information.

The single job for this change is: **start or finish a shift confidently, then
complete the next assigned visit without entering a management workspace**.

## Decision and primary action

On Today, the Carer must decide whether to clock in, manage an active shift or
retry an unavailable shift status before reviewing visits. The shift state and
its state-specific action therefore appear before the visit list.

On My shift, there is one primary action:

- not clocked in: `Clock in`;
- clocked in: `Clock out`;
- loading or submitting: the action is disabled and named for the operation in
  progress;
- unavailable: no mutation action is offered; `Try again` reloads the status.

The decision information is the current shift status, start time and duration
when active, the plain-language location explanation, and whether the Carer has
confirmed the location-processing notice.

On an assigned visit, the next valid action remains visible on a phone:

- scheduled: `Start visit`;
- in progress without recorded care: `Continue recording care`;
- in progress with recorded care: `Complete visit`.

The visit shows only the assignment-scoped name and address needed for the call.
It does not link into the generic client profile or fetch care-planning, Family,
audit or management data.

## Content outline

### Today

- Heading: `Today`
- Supporting text: `Your assigned care visits for today.`
- Shift state:
  - `You are not clocked in`
  - `Shift started at [time]`
  - `Shift status unavailable`
- Primary shift action:
  - `Clock in`
  - `Manage active shift`
  - `Try shift status again`
- Current or next visit
- Other assigned visits or the existing useful empty state

### My shift

- Heading: `My shift`
- Supporting text: `Clock in when you start work and clock out when you finish.`
- Current status:
  - `Not clocked in`
  - `Clocked in`
  - active start time and duration
- Location explanation:
  - location is requested only when clocking in or out;
  - if location is unavailable or declined, Oasis records a manual check;
  - there is no continuous tracking.
- Consent label: `I understand how location is used when I clock in or out.`
- Primary action: `Clock in` or `Clock out`
- Connection note: `Clocking in and out needs an internet connection.`
- Secondary action: `Refresh status`
- Secondary section: `Recent shifts`
- Human proof labels:
  - `Location recorded`
  - `Manual check`
  - `QR code`, `NFC` or `Phone check`

### Assigned visit

- Heading: the name of the person being supported.
- `About [name]`: assignment-scoped address and no management-profile link.
- Connection notice before the workflow.
- Existing Start, Care actions, Care notes and Finish steps.
- One phone-only sticky action naming the next valid step.
- Polite live announcements after starting, recording a task or note,
  escalating, and completing.

## Text wireframe

### Phone

```text
[Oasis header]

Today
Friday 25 July
Your assigned care visits for today.

SHIFT STATUS
You are not clocked in
Clock in when you are ready to start work.
[ Clock in ]

NEXT VISIT
[time] [status]
[person name]
[address]
[care actions]
[ Open visit ]

OTHER VISITS TODAY
[visit cards]
```

```text
[Oasis header]

My shift
Clock in when you start work and clock out when you finish.

CURRENT STATUS
Not clocked in

How location is used
Oasis asks for your location only when you clock in or out.
If it is unavailable, the shift is recorded as a manual check.

[ ] I understand how location is used when I clock in or out.
[ Clock in ]
Clocking in and out needs an internet connection.
[ Refresh status ]

RECENT SHIFTS
[date/time] [duration]
In: Location recorded
Out: Manual check
```

```text
[Oasis header]

[Back to my visits]
[person name]                           [status]

Recording visit activity requires an internet connection.

ABOUT [PERSON]
[assignment-scoped address]

STEP 1. START VISIT
STEP 2. CARE ACTIONS
STEP 3. CARE NOTES
STEP 4. FINISH VISIT

[sticky next valid action]
```

### Tablet and desktop

The reading order does not change. Content remains in a restrained, readable
column. The status and primary action may sit side by side when space permits,
while the recent-shift list remains secondary below them.

## Visual direction and compact tokens

The direction is calm, direct and operational: a shift handover sheet adapted
for a phone, not a dashboard. It uses a flat page, a single bordered status
surface and strong action hierarchy.

- Canvas: existing `oasis-canvas` / secondary background.
- Working surface: white.
- Primary ink: `oasis-ink`.
- Supporting copy and metadata: `oasis-muted`.
- Action and orientation accent: `oasis-teal` and `oasis-teal-soft`.
- State feedback: existing `oasis-success`, `oasis-danger` and their soft
  surfaces.
- Type: existing sans and heading families; one `h1`, compact `h2` section
  headings, readable body copy.
- Layout: one narrow work column with 16px phone gutters and 24px desktop
  spacing.
- Signature detail: the shift block is the first operational surface on Today
  and its button names the next valid shift action.

## Reused and changed foundations

Reuse:

- role-aware `Header`;
- `Button`, including its existing 44px minimum height;
- `Card` for the main shift surface and secondary recent-shift section;
- `Alert` for separate live success and error messages;
- existing Oasis token utilities;
- the existing shift GraphQL operations and location/manual fallback.

No new design token or shared component is needed. A small pure presentation
helper may be introduced beside My shift so proof labels and shift-action copy
are deterministic and unit tested.

## Removals and consolidation

- Replace the technical title `Shift Clock` with `My shift`.
- Remove `proof-of-presence`, payroll and compliance marketing from the page.
- Replace raw `GPS` and `MANUAL` enum values with recognised human labels.
- Remove the combined success/error panel; success and error are separate live
  regions with the correct semantics.
- De-emphasise recent shifts and Refresh beneath the one primary action.
- Remove the visit’s generic `Person details` link and management-style profile
  dependency.
- Do not add metrics, decorative pills, gradients, extra navigation or offline
  write behaviour.

These removals keep the Carer’s current status and next action understandable in
five seconds.

## Responsive review

- At 390×844, the status, action and visit list remain in reading order with a
  full-width primary action.
- The assigned-visit action remains fixed at the phone viewport edge, while
  bottom page padding prevents it from covering care controls or messages.
- At 768×1024 and 1440×900, the action may align beside the status without
  turning the page into a dashboard.
- At 320 CSS pixels and 200% text, controls wrap rather than overflow; recent
  shift times stack and no horizontal scrolling is required.
- The consent label is a minimum 44px target and can wrap over multiple lines.
- Long names, dates, proof labels and error messages wrap within their section.
- There is no motion beyond existing colour transitions; reduced-motion users
  do not lose meaning.

## State matrix

| State | Today | My shift |
| --- | --- | --- |
| Loading | Visits keep the route loading boundary; shift status is not guessed | Current status and recent shifts say they are loading; mutation action is unavailable |
| Empty | Explain that no visits are assigned and link to My visits | Explain that there are no recent shifts |
| Not clocked in | Show `Clock in` before visits | Show consent, `Clock in` and connection requirement |
| Clocked in | Show start time and `Manage active shift` | Show start time, duration and `Clock out` |
| Shift unavailable | Show `Try shift status again`; visits remain usable | Error says status could not be loaded and offers a real retry |
| Validation | Not applicable | Missing consent error explains the required confirmation |
| Submitting | Not applicable | Disable the primary action and name the action in progress |
| Success | Updated server-rendered state on return | Announce clock-in or clock-out success politely |
| Mutation error | Not applicable | Assertive error names the failed action and tells the Carer to try again |
| Offline/connection loss | Do not claim the shift state changed | State that clock actions need a connection; retain the current known state |
| Stale/partial | Shift failure is distinct from empty visit data | Failed refresh does not invent a status or clear the last confirmed shift |
| Permission | Existing route/access boundary applies | Explain the page is for Carers; do not expose shift actions |

Assigned-visit states retain the existing loading, validation, forbidden,
wrong-assignment, mutation failure and completed read-only behaviour. The sticky
action appears only when the Carer has `FRONTLINE_VISIT_EXECUTE`, the visit is
open and a next action is valid. Generic `/clients/{id}` and `/people/{id}`
profiles redirect Carers safely to Today; Managers retain profile access.

## Accessibility checks

- One informative `h1` on each route and ordered `h2` sections.
- Existing header landmarks and skip link remain available.
- The consent checkbox has a visible associated label and a 44px interactive
  row.
- Buttons retain visible focus and 44px minimum targets.
- Success uses a polite live status; errors use an assertive alert.
- Status is expressed in text, never colour alone.
- Loading and submitting states have understandable control names.
- Assigned-visit results are announced politely, repeated submissions are
  single-flight, and the escalation row is a 44px target.
- The mobile sticky action is a named region, stays keyboard reachable and does
  not hide the final form controls.
- Keyboard order follows the visual reading order and Refresh remains a
  secondary button.
- Check reflow at 320 CSS pixels, text resizing, long copy and focus visibility.

## Anti-slop critique before implementation

The plan is specific to the start-of-shift Carer decision and could not be
reused unchanged for a generic analytics product. Its one distinctive choice is
operational rather than decorative: shift state comes before visits on Today.
It adds no gradient, hero, fake metric, decorative pill, new card grid or
animation. The recent-shift history stays secondary. The copy does not make a
payroll, compliance or clinical claim. The smallest useful version changes the
action hierarchy and language while preserving the proven GraphQL and location
fallback behaviour.

## Anti-slop critique after implementation

- Today now shows a state-specific `Clock in`, `Manage active shift` or retry
  action before any visit, so the next shift action is immediately visible.
- My shift has one primary mutation action. Refresh is visually secondary and
  recent records follow the current decision.
- The old payroll/compliance explanation and raw proof enums are gone.
- The main shift surface uses a flat border and one teal orientation edge; no
  gradient, hero, metric wall, decorative pill or extra animation was added.
- The consent row and all shared buttons meet the 44px target requirement.
- Success and error feedback are separate live regions, and connection-required
  copy is next to the mutation action.
- Static review confirms the phone layout stacks status, action and recent
  records without a horizontal layout dependency. Rendered browser and 320px
  reflow checks remain part of the combined PR verification lane.
