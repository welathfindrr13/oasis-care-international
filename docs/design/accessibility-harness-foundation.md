# Accessibility browser harness foundation

## User, context and single job

This harness is for Oasis engineers reviewing the six pilot-critical web surfaces before a pull request is merged. Its single job is to catch WCAG, keyboard, motion and narrow-screen regressions consistently at phone, tablet and desktop sizes.

The covered users and contexts are:

- a signed-out user opening Login;
- a tenant admin reviewing Today;
- a carer opening Today and a visit;
- a family member opening Family;
- a tenant admin reviewing family concerns.

## Decision and primary action

The merge decision is whether all 18 surface-and-viewport combinations remain free of new or unbaselined automated WCAG A/AA Axe violations and horizontal document overflow, remain reachable in sequential keyboard focus order, and honour reduced-motion preferences.

The primary action is running:

```bash
corepack pnpm@9.13.1 exec playwright test --config playwright.accessibility.config.ts
```

Failures include the route, viewport project and assertion evidence. Login carries one exact five-target colour-contrast baseline from the requested base commit; new rules, nodes or changed targets still fail. The baseline must be removed when the truthful-copy correction is integrated.

## Content outline and text wireframe

The harness does not change customer-facing content. It verifies the existing reading order and stable state for each route:

```text
Login
  page shell -> Oasis Care -> Welcome back -> local workspace selector -> Continue

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

The implementation reuses the repository's installed Playwright and `@axe-core/playwright` packages, local NextAuth test provider, global reduced-motion CSS and existing three responsive sizes. It adds one isolated Playwright configuration, one six-test specification and one local mock GraphQL fixture. No application component, token, route, dependency or authentication policy changes.

The mock API returns only explicit synthetic access snapshots and the minimum safe data needed to render each target. Unsupported GraphQL operations fail instead of receiving generic success data.

## Removal and scope control

The harness removes dependence on a developer database and production identity configuration for these structural accessibility checks. It does not replace the linked-carer browser journey, real Clerk testing, API authorization tests, screen-reader testing or testing with people who have access needs.

## Responsive and state review

Each of the six tests runs in Playwright projects at 390×844, 768×1024 and 1440×900, producing 18 cases. Every case checks document overflow after the stable page state is visible. Synthetic states are deliberately bounded:

| Surface | Stable fixture state |
| --- | --- |
| Login | Local test workspace selector |
| Tenant admin Today | Ready tenant-admin access with no visits or exceptions |
| Carer Today | Ready linked-carer access with no assigned visits |
| Visit detail | Ready linked-carer access with one scheduled synthetic visit |
| Family home | Ready linked-family access with no shared care rooms |
| Concerns | Ready tenant-admin access with an empty concern inbox |

Loading, populated, error, offline, denied, stale-data and mutation states remain outside this foundation and should be added only with truthful fixtures for their owning workflows.

## Accessibility checks

Every case verifies:

- one visible `h1`, plus a visible `main` landmark on the five authenticated surfaces;
- Axe WCAG 2.0, 2.1 and 2.2 A/AA results with no disabled rules or excluded page regions, matched against the exact documented Login baseline and zero violations elsewhere;
- no horizontal document overflow;
- no positive `tabindex` values;
- keyboard Tab reaches a visible, named focusable element within the viewport;
- `prefers-reduced-motion: reduce` matches and leaves no long-running animation.

The checks are deterministic and do not activate clinical or destructive controls. Focus-indicator token contrast remains covered by `apps/web/styles/tokens.test.mjs`; this browser foundation tests keyboard reachability without making a brittle computed-style claim.

## Anti-slop critique

Plan critique: a large cross-product test with repeated setup would be harder to maintain and could hide role mistakes. Three Playwright projects create the viewport cross-product while six named tests keep the care context visible. A permissive mock would make false-green tests likely, so unknown operations fail closed.

Final critique: the harness is intentionally plain infrastructure. It adds no visual layer, invented statistics, gradients, decorative states or motion. Login in the exact base commit has no `main` landmark and has five known `slate-400` contrast failures; the harness records those exact debts rather than changing the page from a test-only branch. The baseline is deliberately narrow, so any added violation still fails, and should be deleted as soon as the truthful-copy correction lands. Its other major limitation is that synthetic local authentication does not prove Clerk rendering, production token handling, live API permissions, populated data density, assistive-technology behaviour or clinical workflow safety.
