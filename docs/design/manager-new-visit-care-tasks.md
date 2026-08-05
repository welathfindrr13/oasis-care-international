# Manager New Visit care tasks

## User, context and single job

This change is for a Manager scheduling a new visit. Their single job is to add
the simple care tasks that the assigned Carer should record during that visit.
It does not add task editing after the visit is created.

## Decision and primary action

The primary action remains **Schedule visit**. The Manager needs the person,
assigned Carer, visit time and any optional care-task labels before submitting.
Care tasks remain optional so existing taskless visit types continue to work.

## Content outline

- Existing page heading and visit details.
- New group: **Care tasks (optional)**.
- Explanation: **Add the tasks the Carer should record during this visit. Do
  not add medication instructions here.**
- Each added row has one visible **Care task N** label and one plain-text input.
- Secondary actions: **Add another care task** and **Remove care task N**.
- Validation: **Enter a care task or remove this row.**
- Bounds: up to 20 labels, each no longer than 120 characters.
- Existing primary action: **Schedule visit**.
- Uncertain result: check the Schedule before trying again.

## Text wireframe

```text
main
  Schedule New Visit
  Existing visit details
    Person
    Carer
    Start time / End time
    Visit notes

    Care tasks (optional)
      helper and medication boundary
      Care task 1 [                         ] [Remove care task 1]
      Care task 2 [                         ] [Remove care task 2]
      [Add another care task]

    validation or request error
    [Cancel] [Schedule visit]
```

On narrow screens each task input and its remove action stays in one vertical
reading order. Nothing becomes sticky and there is no competing primary action.

## Visual direction and foundations

The direction is a restrained operational form, matching the existing New Visit
page rather than adding a new visual system.

- canvas: existing `background-secondary`;
- surface: existing `Card`;
- primary text: existing `text-primary`;
- supporting text: existing `text-secondary`;
- primary action and focus: existing Oasis teal roles;
- validation: existing Oasis error roles.

Existing `Button`, `Card`, input styles and focus treatment are reused. The only
signature detail is the numbered, plainly labelled task rows, which helps the
Manager and Carer refer to the same actions. No new token or shared component is
needed.

## Removal and scope control

The first slice deliberately omits task descriptions, templates, categories,
drag ordering, post-creation editing, medication, recurring visits, offline
writes, feature flags and a generic workflow engine. Duplicate labels are not
blocked because the product has no confirmed rule that they are invalid.

## Responsive and state review

- 320px and 390x844: one column, labels wrap, controls remain at least 44px,
  and there is no horizontal scroll.
- 768x1024 and 1440x900: task rows remain within the existing form width.
- Long labels stop at 120 characters; enlarged text wraps without hiding the
  remove action.
- Empty: no task rows, with a clear **Add another care task** action.
- Validation: entered values remain, the first invalid input receives focus,
  and its error is linked to the field.
- Submitting: the primary action is disabled and one mutation is allowed.
- Success: existing Schedule redirect.
- Uncertain network result: no automatic retry; the Manager is told to check
  the Schedule before trying again.
- Permission and load failures: existing safe page states remain unchanged.
- Offline: the existing request fails without storing an offline care write.

## Accessibility checks

- Existing single `h1` and form reading order remain unchanged.
- The task collection uses a `fieldset` and `legend`.
- Every input has a visible label and stable name.
- Field errors use `aria-invalid` and `aria-describedby` and move focus to the
  first invalid field.
- Add and remove actions are keyboard operable, specifically named and at least
  44px high.
- Error feedback uses alert semantics and does not rely on colour.
- Keyboard, automated accessibility and 320px reflow checks cover the new group.

## Pre-implementation anti-slop critique

This change is specific to a Manager preparing an assigned care visit. It adds
one necessary form group and reuses the existing flat form foundation. There is
no dashboard, hero, card wall, decorative status treatment, invented care data
or marketing copy. The principal risks are turning a label field into an
unbounded care-plan editor, allowing partial visit/task saves, or using the task
as a medication workaround. The narrow label-only contract, bounded validation,
atomic save and explicit medication boundary address those risks without a
redesign.

## Verification evidence

- Care-task rule tests cover zero, one and twenty tasks, trimming, duplicates,
  blank rows, long labels, excessive rows and uncertain network results.
- The full web suite passes: 210 tests. Focused care-task and GraphQL client
  checks pass 10 tests, including typed 500, 502, 503 and 504 outcomes.
- The full API suite passes after disposable Prisma-client generation: 565
  tests. The follow-up visit unit slice passes 60 tests.
- Two focused real-PostgreSQL API checks prove the exact trimmed task is stored,
  returned to the assigned Carer, denied to a different Carer, and that a forced
  nested task-insert failure leaves neither the visit nor task behind.
- The production web build passes with synthetic Clerk build configuration.
- The repository accessibility suite passes 76 checks with 8 intentional skips
  across phone, tablet and desktop projects, including 320px reflow coverage.
- The disposable PostgreSQL linked-Carer browser suite passes 22 checks. Its
  Manager flow covers task add/remove, linked validation and focus, preserved
  values, one-submit behaviour, 44px controls and 320px reflow; its Carer and
  tenant tests retain assigned-work and role boundaries.

A focused rerun of that browser flow after the review amendments stopped on the
existing local-auth **Switching account** interstitial before the changed form
loaded. It did not fail a care-task assertion. The run was not repeatedly
retried or used to justify an unrelated authentication change; the exact
trimmed persistence and assigned-Carer boundary are covered by the passing
real-database API checks above.

The automated browser proof uses the repository's Chromium configuration. A
manual Safari/WebKit visual pass remains appropriate during independent review,
but no Safari-specific code path was introduced.
