# Truthful public, sign-in and metrics copy

## Oasis design note

This change follows the Oasis product-design skill: calm NHS-style language, explicit access states, no unsupported compliance or transport-security claims, no internal product jargon, and no control that implies an action it cannot perform. It changes content and semantics only; authentication, authorization, clinical workflows and data projections are unchanged.

The health-summary export and shift refresh are intentionally excluded because active isolated timezone and shift-integrity branches already own those files. They must be corrected and reviewed in those branches before their PRs are published.

## Text wireframe

```text
Public
  Oasis Care                           Sign in
  Clear records for home care
  Keep care plans, visits and updates clear.
  [Request company access] [Open Manager Today] [Review family updates]
  Core care-record loop
  Plan | Deliver | Prove | Reassure | Improve

Sign in
  Oasis Care
  Care records for your organisation
  Welcome back
  [Sign in]
  Organisation access
  Assigned-access explanation
  Manager or Oasis support help message

Metrics
  Source | Environment | Access
  Raw response from authenticated metrics endpoint
  Unavailable means unavailable; no inferred API/database status
```

## State matrix

| Surface | State | User-facing result |
| --- | --- | --- |
| Public | signed out | Clear service description and three real navigation links |
| Login | Clerk | Organisation-account instruction and Clerk control |
| Login | legacy configured provider | One plain `Sign in` action |
| Login | local development/test | Explicit test workspace selector |
| Login | provider/configuration error | Bounded, actionable error without internals |
| Access | no membership, disabled, pending, setup, unavailable | One calm explanation, Manager or support action, and confirmation that no care information loaded |
| Metrics | endpoint responds | Raw authenticated response only |
| Metrics | endpoint unavailable | Bounded unavailable text; no fabricated health status |

## Responsive and reduced-motion review

- Verified at 390×844, 768×1024 and 1440×900 in Chromium with `en-GB` locale.
- Mobile public actions stack without horizontal overflow; the header sign-in label is forced to one line.
- Login retains one clear action and readable line lengths at all three viewports.
- The changed surfaces add no animation. Automated browser checks used `prefers-reduced-motion: reduce`.

## Anti-slop critique

Before: `care OS`, `command centre`, `256-bit SSL`, `GDPR Compliant`, hard-coded green API/database status, and an inert Refresh button made claims the interface could not prove.

After: descriptive service language, role-specific `Manager Today`, a plain account-access explanation, observed metrics only, and no inert control. The visual system is deliberately unchanged; this is a truth and semantics pass, not a decorative redesign.

## Accessibility and keyboard evidence

- Axe: zero violations on public and login at all three viewports; no allowlist.
- Access states: all five states passed Axe and horizontal-overflow checks at all three viewports (15/15) through the repository's development-only Clerk browser stub. Browser Use separately confirmed the `unavailable` DOM, actions and rendered layout.
- Keyboard: public focus order is Sign in → Request company access → Open Manager Today → Review family updates. Login exposes one Sign in action and returns to it after the document tab cycle.
- Login now has one `main` landmark and a `footer`; low-contrast slate-400 text was raised to slate-600.
- In-app Browser review confirmed the final public, login and representative access-state DOM and rendered layouts. The production-like server reported the expected local auth fetch error because no `COGNITO_ISSUER` was supplied; protected visual evidence therefore used the explicit `OASIS_BROWSER_CLERK_STUB` development fixture. No sign-in was attempted and authenticated behaviour is unchanged.
- Authenticated metrics and hosted Clerk screens are not claimed as visually verified in this branch; they require the later synthetic tenant/auth fixture gate.
- Full web tests: 102/102 passed. Production web build passed.

## Screenshots

| Viewport | Public | Login | Access: no membership | Access: unavailable |
| --- | --- | --- | --- | --- |
| 390×844 | [public mobile](evidence/truthful-copy/public-390x844.png) | [login mobile](evidence/truthful-copy/login-390x844.png) | [no membership mobile](evidence/truthful-copy/access-no-membership-390x844.png) | [unavailable mobile](evidence/truthful-copy/access-unavailable-390x844.png) |
| 768×1024 | [public tablet](evidence/truthful-copy/public-768x1024.png) | [login tablet](evidence/truthful-copy/login-768x1024.png) | [no membership tablet](evidence/truthful-copy/access-no-membership-768x1024.png) | [unavailable tablet](evidence/truthful-copy/access-unavailable-768x1024.png) |
| 1440×900 | [public desktop](evidence/truthful-copy/public-1440x900.png) | [login desktop](evidence/truthful-copy/login-1440x900.png) | [no membership desktop](evidence/truthful-copy/access-no-membership-1440x900.png) | [unavailable desktop](evidence/truthful-copy/access-unavailable-1440x900.png) |
