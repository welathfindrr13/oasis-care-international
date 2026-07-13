---
name: oasis-product-design
description: Design and implement Oasis Care UI for managers, carers, care workers, and families using repository evidence, deliberate visual direction, NHS-style content, and WCAG 2.2 AA checks.
---

# Oasis product design

Use this skill for Oasis Care UI, UX, content, navigation, accessibility, and visual-system work. Treat the repository as the source of truth. Before proposing a change, inspect the relevant routes, role access, components, tokens, API/GraphQL data, workflow states, and existing copy.

This skill adapts Anthropic’s frontend-design process to a care product: make choices specific to the subject, plan and critique before coding, and reject generic AI-generated layouts. It also applies NHS digital service content and accessibility guidance and WCAG 2.2 AA. Read the linked references before work on role journeys, copy, or critique.

## Required gate before UI code

Do not write UI code until the task includes all of the following:

1. User, context, and single job: identify who is using the page, where they are in the care workflow, and the one job the page must help them complete.
2. Decision and primary action: name the primary action and the information needed to make that decision. Remove competing primary actions.
3. Content outline: write the page purpose, heading, supporting explanation, labels, actions, and state messages in short plain English.
4. Text wireframe: show the reading order, hierarchy, data dependencies, primary/secondary actions, and mobile changes in text or ASCII.
5. Visual direction: choose a deliberate direction grounded in the care context. State the intended tone, density, palette, typography, layout, and one useful signature detail. Do not default to a generic dashboard.
6. Foundation review: reuse existing Oasis tokens and components where they are sound. If a new component or token is needed, explain the user need, why existing pieces fail, and how it will be tested and maintained.
7. Removal note: state what is being removed, consolidated, or de-emphasised and why that makes the task clearer or safer.
8. Responsive review: check mobile and desktop widths, zoom/reflow, long names, long messages, touch input, and narrow screens.
9. State matrix: review loading, empty, error, success, offline, stale/partial data, and permission states. Every page needs a useful empty state and a clear next step.
10. Anti-slop critique: use `references/oasis-anti-slop-checklist.md`, critique the plan before implementation, then critique the rendered result before completion.

## Oasis rules

- Manager screens focus on organising care, people, schedules, and exceptions. Put decisions, ownership, due dates, and exceptions before reporting.
- Carer screens focus on today’s assigned visits, useful client information, and fast, safe visit completion.
- Family screens focus on understanding what happened, what is next, and whether attention is needed.
- Use “carer” or “care worker”, never vague “staff” when addressing frontline workers.
- Use everyday language instead of internal product or engineering terms.
- Ban unexplained customer-facing phrases including “care OS”, “assurance room”, “proof-led care”, “capability matrix”, and “operational command centre”.
- Avoid default gradients, glassmorphism, excessive rounded cards, generic dashboards, fake statistics, decorative pills, giant hero sections, and unnecessary animation.
- Do not add motion unless it improves orientation, feedback, or understanding. Respect reduced-motion preferences.
- Never invent care data, clinical claims, compliance badges, testimonials, or outcomes.
- Do not use lorem ipsum, generic placeholder names, internal IDs, or system terminology as customer-facing content.
- Keep touch targets at least 44px; use semantic HTML, visible keyboard focus, clear names, and keyboard-operable interactions. Meet WCAG 2.2 AA.
- Do not rely on colour or position alone to convey meaning. Do not use an accessibility widget or overlay as a substitute for accessible code and testing.
- Keep family content within existing access and sharing policy. Do not expose raw operational notes or sensitive medication detail without explicit product evidence that it is allowed.
- Use sentence case and direct, calm wording.

## Source-informed design method

Follow this sequence for each page or component:

### 1. Understand the subject

Name the concrete user, context, and job. Use the real care workflow and real repository vocabulary. If data or policy is missing, record a product question; do not fill the gap with invented content.

### 2. Brainstorm and plan

Write a compact design plan before coding:

- 4–6 named colour roles using existing Oasis tokens where possible.
- Type roles, scale, weight, and readable line length.
- Layout concept and text/ASCII wireframe.
- One signature detail that helps orientation or care work, not decoration.

Critique this plan against the brief. If it could be reused unchanged for any generic SaaS product, revise it. Spend visual boldness in one justified place and keep the rest disciplined.

### 3. Design content as interface material

Use active voice and specific labels. Name things by what the person recognises or controls, not how the system is built. Keep action names consistent through the flow: the button and the success message should use the same verb. Errors must say what happened and how to recover. Empty states must explain the absence and point to a next step.

### 4. Build accessibly

Use one informative page title and one clear `h1`; keep headings in order. Use `header`, `nav`, `main`, `search`, and other landmarks when present, and provide a visible-on-focus skip link for repeated navigation or long forms/lists. Give every form control a visible, associated label; group related controls with a legend; connect field errors to fields and error-summary links to focus targets. Preserve entered data when showing errors.

Check text and non-text contrast, focus visibility and focus not being obscured, keyboard order, status messages, link purpose, target size, reflow, text resizing, alt text, reduced motion, and meaning without colour. Test with automated checks plus keyboard and, where practical, assistive technology and users with access needs.

### 5. Critique the result

Review screenshots or the running page at mobile and desktop widths when available. Remove one unnecessary visual element. Ask whether the next action is obvious in five seconds, whether a carer could use it during a visit, whether a family member could understand it without product training, and whether a manager can see the decision or exception without scanning a wall of cards.

## Oasis repository map

Start with `apps/web/styles/tokens.css`, `apps/web/components/oasis/Header.tsx`, and `apps/web/components/ui/`. Check for drift where pages use raw Tailwind slate/teal/sky values, gradients, emoji navigation, large radii, shadows, or hover lifts instead of shared foundations.

Current header navigation is role- and capability-gated. Tenant admins see Today, People, Schedule, Workforce, Family updates, Reports, and Settings. Carers see Today, My visits, My shift when permitted, and Profile/help. Family members see Home, Updates, Latest update, and Concerns/help. Manager, care-manager, and office memberships without a frontline capability are currently restricted to Settings; do not assume a broader manager workspace until canonical capabilities prove it. Medication remains a workflow route, not a current carer header item. Treat `/dashboard`/`/today`, `/clients`/`/people`, `/visits`/`/schedule`, and `/carebridge`/`/family-updates` as route aliases and navigation debt to understand before changing.

Current care workflows include people/client records, scheduled visits, assigned carers, visit tasks and completion, shift clock-in/out, care logs, medication administration and exceptions, assessments, care plans, evidence packs, family-safe verified visit updates, approval/rejection, and concern cases. Preserve their permissions and meaningful states.

Keep diffs narrow, preserve unrelated dirty-tree changes, and do not change API, permissions, production behaviour, or care-record semantics unless explicitly requested. Verify the relevant route, keyboard path, responsive layout, and state matrix after implementation.

## Required design note

Before implementation, record: user/job; primary action and decision information; content outline; text wireframe; visual direction and compact tokens; reused and changed foundations; removals and rationale; responsive notes; state matrix; accessibility checks; and anti-slop critique.

## References and source material

- [oasis-content-principles.md](references/oasis-content-principles.md) — Oasis terminology and NHS-informed content rules.
- [oasis-role-journeys.md](references/oasis-role-journeys.md) — current routes, roles, care workflows, and visual audit.
- [oasis-anti-slop-checklist.md](references/oasis-anti-slop-checklist.md) — plan and implementation critique.
- [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) — subject-specific direction, plan–critique–build–critique, typography, copy, restraint, responsive design, focus, and reduced motion.
- [NHS content guide](https://service-manual.nhs.uk/content) — clear and consistent digital health content.
- [NHS accessibility design guidance](https://service-manual.nhs.uk/accessibility/design) — WCAG 2.2, landmarks, skip links, headings, contrast, focus, labels, errors, and tested components.
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/) — success criteria and implementation techniques.
