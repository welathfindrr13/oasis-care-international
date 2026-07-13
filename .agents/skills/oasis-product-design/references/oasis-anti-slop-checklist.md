# Oasis anti-slop checklist

Use this checklist twice: once against the plan before coding and once against the running or rendered result. Record evidence and decisions, not only checkmarks.

The first section adapts Anthropic’s frontend-design skill: ground the direction in the subject, use a compact plan, critique defaults, and spend boldness in one justified place. The rest combines the Oasis rules, NHS accessibility design guidance, and relevant WCAG 2.2 AA criteria.

## 1. Subject and job

- Can I name the user, context, and single job in one sentence?
- Is the primary action obvious in five seconds?
- Does the page show the information needed for that action before secondary detail?
- Does the visual direction come from care work, the user, or the real data—not a generic SaaS template?

## 2. Plan before code

- Does the plan include 4–6 named colour roles, type roles, layout, wireframe, and one useful signature detail?
- Does the signature detail improve orientation, feedback, or understanding?
- If the plan could be reused unchanged for any product, was it revised?
- Did the critique avoid default AI looks such as purple-gradient SaaS, warm editorial cream/terracotta, near-black/acid-green, or broadsheet styling unless the brief truly calls for it?
- Is the design restrained around the one distinctive choice?

## 3. Content

- Are headings, links, labels, and buttons specific, active, sentence case, and meaningful out of context?
- Are “care OS”, “assurance room”, “proof-led care”, “capability matrix”, “operational command centre”, unexplained “SLA”, and internal IDs absent from customer-facing copy?
- Does the same action keep the same name through the flow?
- Does every empty state explain why it is empty and give a clear next step?
- Do errors explain what happened and how to recover without vague apology or false reassurance?

## 4. Care safety

- Are all displayed records, names, states, and metrics supported by the repository?
- Did I avoid invented care data, clinical claims, compliance badges, testimonials, and outcomes?
- Is family content approved, scoped, and free of raw operational notes unless policy explicitly allows it?
- Are approve, publish, complete, refuse, escalate, archive, and delete actions explicit and safely confirmable?
- Are meaningful workflow states preserved rather than reduced to colour or a generic badge?

## 5. Foundation and visual quality

- Are existing Oasis tokens and components reused where sound?
- If a custom component was added, is there evidence existing components could not meet the need, plus a plan to test and maintain it?
- Did I remove or avoid gradients, glassmorphism, excessive rounded cards, decorative pills, fake statistics, giant hero sections, hover lifts, and ornamental animation?
- Is hierarchy created by content, spacing, contrast, and grouping rather than a grid of cards?
- Is meaning available without colour or position alone?

## 6. WCAG/NHS interaction review

- Is there one informative page title and one clear `h1`, with headings in order?
- Are landmarks present where relevant: banner, navigation, search, main, and content info?
- Is there a skip link that becomes visible on focus for repeated navigation or long lists/forms?
- Does every field have a visible associated label; do groups have legends?
- Are errors next to fields and, where needed, in a linked error summary that moves focus?
- Are all actions keyboard operable with visible focus that is not obscured?
- Are focus order, link purpose, status messages, and names/roles/values understandable to assistive technology?
- Do text and non-text controls meet contrast requirements, and is status not colour-only?
- Does the layout reflow, resize, and remain usable on mobile and at large text/zoom?
- Are images decorative or informative intentionally labelled; is text kept out of raster images?
- Are interactive targets at least 44px for Oasis, exceeding WCAG’s minimum target-size expectation where practical?
- Is motion reduced or removed for people who request reduced motion?
- Were automated accessibility checks, keyboard checks, and practical assistive-technology or access-needs tests run or explicitly marked as outstanding?

## 7. Final removal pass

Ask: what can be removed without losing care meaning? Remove one unnecessary visual element, one repeated explanation, or one competing action. If removal makes the workflow less safe, restore it and explain why. If the result still looks interchangeable with an AI-generated admin template, revise the plan before polishing.
