# Public and sign-in coherence

## User, context and single job

The public page is for a care-company decision-maker or existing Oasis user who is signed out. Its single job is to explain, in plain language, what records Oasis keeps together and direct the person to the right access route.

The sign-in page is for a manager, carer, care worker or family member who already has an organisation-provided account. Its single job is to sign in to the correct workspace without exposing provider or environment detail.

## Decision and primary action

On the public page, the decision is whether the visitor needs company access or already has an account. The one primary action is **Request company access**. **Sign in**, **Open Manager Today** and **Review family updates** remain real secondary routes for people who already have access.

On the sign-in page, the one primary action is the active provider's sign-in control. The person needs to know that they should use the account provided by their organisation and where to ask for help.

## Content outline

- Public title: **Clear care records, from plan to visit update**.
- Public explanation: care plans, visit records, approved family updates and concerns are kept in one workspace; available features depend on the organisation's setup.
- Public primary action: **Request company access**.
- Public secondary actions: **Sign in**, **Open Manager Today**, **Review family updates**.
- Public journey: plan care; record each visit; review what needs attention; share approved updates.
- Sign-in title: **Sign in to Oasis Care**.
- Sign-in explanation: use the account provided by the organisation; assigned access controls what opens.
- Sign-in errors: retain the existing bounded recovery messages without provider or configuration detail.
- Sign-in help: contact a Manager or Oasis support.

## Text wireframe

```text
Public
  banner
    Oasis Care — Care records for home-care teams
    Sign in
  main
    Clear care records, from plan to visit update
    What Oasis keeps together and organisation-setup note
    [Request company access]
    Already have access? Open Manager Today | Review family updates
    How the record moves through care
      1 Plan care
      2 Record each visit
      3 Review what needs attention
      4 Share approved updates
    Clear boundaries
      Approved family updates do not expose internal care records
  content info
    Oasis Care

Sign in
  main
    Back to Oasis Care
    Sign in to Oasis Care
    Organisation-account guidance
    sign-in surface
      bounded error, if present
      local fixture: Workspace + [Continue]
      Clerk fixture: hosted SignIn control
      Unsupported provider configuration: [Calm, non-interactive support message]
    assigned-access explanation
    help route
  content info
    Oasis Care
```

On narrow screens, the public reading order stays linear and the secondary role links stack. The sign-in orientation copy moves above the form; no content is hidden or reordered semantically.

## Visual direction and compact tokens

The direction is a calm care-record front door: flat, high-contrast surfaces; compact headings; generous but not heroic spacing; and clear rules between sections. It should feel like a dependable care service, not a marketing dashboard.

- canvas: `oasis-canvas`;
- record surface: `oasis-surface`;
- primary text: `oasis-ink`;
- secondary text: `oasis-muted`;
- action and orientation rule: `oasis-teal` / `oasis-teal-dark`;
- boundaries and controls: `oasis-border` / `oasis-control-border`.

Type uses the existing Oasis heading and body families, with the public `h1` capped at a readable measure and a restrained responsive scale. The signature detail is a numbered, ordered care-record journey joined by a simple vertical rule. It explains sequence and supports orientation; it is not decorative.

## Reused and changed foundations

The implementation reuses the existing Oasis colour, type, radius, control and focus tokens, semantic landmarks, Next.js links, the Clerk `SignIn` surface, local test selector and the maintained accessibility browser harness. An unsupported provider configuration fails closed with a non-interactive support message. No token, dependency, shared component, middleware, access, capability, API or authentication file changes are needed.

The public and sign-in pages keep their small route-specific markup because the approved scope excludes shared-component changes. The new sign-in layout provides route-specific metadata only.

## Removal and scope control

The public page removes the gradient backdrop, glass effects, decorative pill label, oversized hero type, repeated card grid, deep shadows and competing button treatment. Five broad marketing pillars and a seven-item internal-sounding loop become one semantic four-step record journey.

The sign-in page removes decorative iconography, centred brand repetition, an ornamental divider and motion in the loading fallback. The final removal pass also removes one repeated access explanation from the orientation panel. It keeps every real authentication branch and bounded error.

The public footer no longer repeats the service descriptor already present in the banner.

No claim about compliance, security, care outcomes, provider health or product availability is added. Protected role links remain protected routes; this work does not change access.

## Responsive and reduced-motion review

- 320px: one column, no clipped words or controls, 44px minimum targets, secondary role links stacked.
- 390×844: public action and journey remain readable without horizontal scroll; sign-in controls fill the available width.
- 768×1024: comfortable single-column reading measure with the journey using available width.
- 1440×900: public explanation and ordered journey share the page without a giant hero; sign-in orientation and form use a balanced two-column layout.
- 200% zoom at a 1280×800 CSS viewport: content reflows without overlap, loss or two-dimensional scrolling.
- Long error/help copy wraps within the sign-in surface.
- No new animation is added; the loading state is static and the maintained suite uses `prefers-reduced-motion: reduce`.

## State matrix

| Surface | State | User-facing result |
| --- | --- | --- |
| Public | signed out | Service purpose, primary access request and real secondary access routes |
| Public | protected route selected | Existing middleware and access resolution handle the destination; no public-page permission logic changes |
| Sign in | loading | Static **Loading sign-in** status |
| Sign in | Clerk | Organisation guidance and the hash-routed Clerk control; generic transfer-to-sign-up and the sign-up footer action are disabled |
| Sign in | unsupported provider configuration | No provider action; a calm support message is shown |
| Sign in | local development/test | Visible **Workspace** selector and **Continue** action |
| Sign in | known callback error | Existing specific, bounded retry message |
| Sign in | other error | Existing bounded retry/help message without internals |
| Sign in | offline/provider unavailable | No invented state; provider failure remains owned by the provider flow and existing error return |
| Sign in | authenticated with a valid internal callback | One normalized internal Oasis path is passed to the active local or Clerk flow |
| Sign in | unsafe or malformed callback | The destination falls back to `/access`; absolute, schemed and protocol-relative destinations are not passed to a provider |

The public page has no data-backed loading, empty, stale or partial state. The sign-in page has no care data, so it must not imply that records loaded or were lost.

## Accessibility checks

- one informative `h1` and one `main` on each page;
- banner/navigation and content-information landmarks where present;
- the `h1` is the first heading in reading order, followed by the sign-in help `h2`;
- visible associated local-workspace label;
- bounded errors use an alert role;
- all links, buttons and the select are keyboard operable, named and at least 44px high;
- existing global focus treatment remains visible;
- no positive `tabindex`, horizontal overflow or long-running reduced-motion animation;
- zero Axe WCAG A/AA violations at 390×844, 768×1024 and 1440×900 through the maintained browser harness;
- manual 320px reflow, 200% zoom and screenshot review.

Automated checks do not prove full WCAG 2.2 AA conformance or replace screen-reader testing and testing with people who have access needs. Hosted Clerk rendering remains outside the local-fixture visual proof.

## Pre-implementation anti-slop critique

The plan is specific to the movement of a home-care record and the access decision; the ordered journey would not transfer unchanged to a generic SaaS landing page. The teal rule spends visual emphasis on sequence rather than decoration. The plan has one primary public action and one sign-in action, uses no invented metrics or claims, and removes gradients, glass, pills and a grid of interchangeable cards.

Risks before implementation are that the ordered journey could become another decorative timeline, that secondary protected routes could compete with the access request, and that a visual sign-in rewrite could alter provider behavior. The implementation must keep the journey semantic and terse, render secondary routes as text links, and lock the authentication contract with source tests.

## Verification evidence

- Maintained web tests: 118/118 passed with `corepack pnpm@9.13.1 --filter @oasis/web test`, including the registered login-rendering contract and executable relative, same-origin absolute and rejected callback normalization cases.
- Explicit sign-in source contract tests: 4/4 passed with `node --test apps/web/app/login/page.test.js`, including heading source order.
- Accessibility fixture parser: 4/4 passed.
- Maintained accessibility browser suite: 21/21 passed across 390×844, 768×1024 and 1440×900. Each case exercised zero-allowlist Axe WCAG A/AA analysis, bounded keyboard traversal, focus visibility, no positive `tabindex`, horizontal overflow, one `h1`, one `main` and reduced motion.
- Lint: no warnings or errors.
- Production web build: passed with the repository's synthetic CI authentication configuration.
- Browser Use review: Public and Login inspected at desktop and phone sizes. It found and prompted fixes for the original two-row journey-marker collision and the wrapped mobile **Sign in** label. The bounded OAuth callback error was also inspected at 390px with one alert and no overflow.
- 320px Browser Use reflow: Public and Login both reported `scrollWidth === innerWidth === 320`; the public sign-in target was 44px high, the local selector was 44px high and Continue was greater than 44px high.
- 200% zoom proxy: at the effective 640×400 CSS viewport produced by a 1280×800 browser zoomed to 200%, Public and Login both reported no horizontal overflow. This is a deterministic reflow proxy, not assistive-technology proof.
- `git diff --check`: passed after the final content and visual changes.

### Reviewed screenshots

| Viewport | Public | Login |
| --- | --- | --- |
| 390×844 | [Public phone](evidence/public-login-coherence/public-390x844.png) | [Login phone](evidence/public-login-coherence/login-390x844.png) |
| 768×1024 | [Public tablet](evidence/public-login-coherence/public-768x1024.png) | [Login tablet](evidence/public-login-coherence/login-768x1024.png) |
| 1440×900 | [Public desktop](evidence/public-login-coherence/public-1440x900.png) | [Login desktop](evidence/public-login-coherence/login-1440x900.png) |

## Final anti-slop critique

The rendered result reads as a care-record service rather than a generic SaaS landing page: the only distinctive treatment explains how a record moves through care, while the rest uses flat surfaces, rules, spacing and existing Oasis tokens. There are no gradients, glass effects, decorative pills, fake statistics, testimonials, badges, ornamental animation or unsupported assurance claims.

The primary public action is obvious within five seconds and the two protected role routes are visibly secondary text links. The sign-in page has one active provider action, keeps help close to the form and does not expose provider configuration. Phone and tablet views retain the semantic order and do not shrink controls.

Browser review initially exposed a timeline marker defect that automated Axe checks did not catch; switching to a vertical journey through tablet and one four-column row at wide screens resolved it. It also exposed the mobile sign-in wrap, resolved with a no-wrap control label. The final removal pass deleted the repeated public footer descriptor and shortened duplicate sign-in orientation copy. Removing any further element would start to remove the access boundary, help route or care-record explanation needed for the decision.

Outstanding limits remain explicit: hosted Clerk visuals, screen-reader use, non-Chromium behavior and testing with people who have access needs are not proven by this PR.
