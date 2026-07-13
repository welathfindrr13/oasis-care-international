# Accessibility browser harness foundation

## User, context and single job

This harness is for Oasis engineers reviewing the seven pilot-critical web surfaces before a pull request is merged. Its single job is to catch automated WCAG, bounded keyboard-traversal, motion and narrow-screen regressions consistently at phone, tablet and desktop sizes.

The covered users and contexts are:

- a signed-out user opening the public page or Login;
- a tenant admin reviewing Today;
- a carer opening Today and a visit;
- a family member opening Family;
- a tenant admin reviewing family concerns.

## Decision and primary action

The merge decision is whether all 21 surface-and-viewport combinations remain free of automated WCAG A/AA Axe violations and horizontal document overflow, complete a bounded sequential keyboard traversal without traps or invalid focus, and honour reduced-motion preferences.

The primary action is running:

```bash
corepack pnpm@9.13.1 test:browser:accessibility
```

The maintained command first runs the fixture parser tests and then the 21 browser cases. Failures include the route, viewport project and assertion evidence. Every surface, including Public and Login, must return zero Axe violations. The same command runs in natural CI after Chromium installation, and `.github/workflows/ci.test.mjs` guards both the root script and workflow ordering against silent removal.

## Content outline and text wireframe

The harness does not change customer-facing content. It verifies the existing reading order and stable state for each route:

```text
Public
  banner -> Oasis Care -> Sign in
  main -> service purpose -> Request company access -> protected role links
       -> sharing boundaries -> ordered care-record journey
  content info -> Oasis Care

Login
  main -> Back to Oasis Care -> Sign in to Oasis Care
       -> organisation guidance -> local workspace selector -> Continue -> help
  content info -> copyright

Tenant admin Today
  header -> main -> Today -> summary -> needs attention -> today’s visits

Carer Today
  header -> main -> Today -> shift status -> assigned visits or empty state

Visit detail
  header -> main -> person and status -> visit details -> tasks -> care note -> completion

Family home
  header -> main -> family updates -> people -> concerns help -> latest update

Concern inbox
  header -> main -> concern queue -> status filter -> concern list or empty state
```

Phone and tablet projects use the compact header. Desktop uses the full navigation. The content order is unchanged across viewports.

## Visual direction and compact tokens

This is test infrastructure, not a visual redesign. The harness observes the existing Oasis foundation:

- page background: `background-secondary`;
- content surface: `background-primary`;
- primary text: `text-primary`;
- secondary text: `text-secondary`;
- action and navigation: `accent-teal-dark`;
- keyboard focus: `focus`.

Body and heading roles remain defined by the existing global tokens. The useful signature detail is evidence grouped by named role surface and viewport rather than generic route numbers.

## Reused and changed foundations

The implementation reuses the repository's installed Playwright, GraphQL parser and `@axe-core/playwright` packages, local NextAuth test provider, global reduced-motion CSS and existing three responsive sizes. It maintains one isolated Playwright configuration, one seven-test specification, fixture parser tests and one local mock GraphQL fixture. The shared Header adds a focus-visible “Skip to main content” link and assigns the current `main` landmark a focus target without changing routes, tokens, dependencies, authentication policy or care-record behaviour. Public extends the signed-out coverage without adding an API fixture or authentication dependency.

The mock API parses each GraphQL document, requires one named query and dispatches only exact allowlisted operation names. Malformed, anonymous, multiple, mismatched, mutation and unsupported operations fail closed instead of receiving generic success data.

## Removal and scope control

The harness removes dependence on a developer database and production identity configuration for these structural accessibility checks. It does not replace the linked-carer browser journey, real Clerk testing, API authorization tests, screen-reader testing or testing with people who have access needs.

## Responsive and state review

Each of the seven tests runs in Playwright projects at 390×844, 768×1024 and 1440×900, producing 21 cases. Every case checks document overflow after the stable page state is visible. Synthetic states are deliberately bounded:

| Surface | Stable fixture state |
| --- | --- |
| Public | Signed out with real public and protected navigation links |
| Login | Local test workspace selector |
| Tenant admin Today | Ready tenant-admin access with no visits or exceptions |
| Carer Today | Ready linked-carer access with no assigned visits |
| Visit detail | Ready linked-carer access with one scheduled synthetic visit |
| Family home | Ready linked-family access with no shared care rooms |
| Concerns | Ready tenant-admin access with an empty concern inbox |

Loading, populated, error, offline, denied, stale-data and mutation states remain outside this foundation and should be added only with truthful fixtures for their owning workflows.

## Accessibility checks

Every case verifies:

- one visible `h1` and one visible `main` landmark on every surface, plus a visible content-information footer on Public and Login;
- zero Axe WCAG 2.0, 2.1 and 2.2 A/AA violations, with no disabled rules or excluded page regions;
- no horizontal document overflow;
- no positive `tabindex` values;
- bounded, non-activating Tab traversal reaches every visible focusable element once, detects early repeats or traps, and rejects invisible, unnamed, non-focus-visible or out-of-viewport focus;
- repeated-header surfaces expose a visible-on-focus skip link whose safe activation moves focus to the `main` landmark;
- `prefers-reduced-motion: reduce` matches and leaves no long-running animation.

The traversal checks are deterministic and do not activate clinical or destructive controls; only the non-destructive skip link is activated in its separate bypass assertion. Focus-indicator token contrast remains covered by `apps/web/styles/tokens.test.mjs`; this browser foundation tests sequential reachability and `:focus-visible` state without claiming visual focus-indicator contrast from computed styles.

## Anti-slop critique

Plan critique: a large cross-product test with repeated setup would be harder to maintain and could hide role mistakes. Three Playwright projects create the viewport cross-product while seven named tests keep the care context visible. Public is a separate signed-out case because its access links and reading order differ from Login. A permissive mock would make false-green tests likely, so unknown operations fail closed.

Final critique: the harness is intentionally plain infrastructure. It adds no decorative visual layer, invented statistics, gradients, decorative states or motion. The bypass link appears only on keyboard focus and uses the existing Oasis focus treatment. This automated foundation does not prove complete WCAG 2.2 AA conformance and does not replace manual keyboard review, screen-reader or other assistive-technology testing, testing with people who have access needs, Clerk rendering, production token handling, live API permissions, populated data density or clinical workflow safety.
