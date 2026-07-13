# Oasis content principles

This reference adapts the NHS digital service manual’s content guide to Oasis Care. The NHS guide is guidance rather than a rulebook: adapt patterns when user research shows a better way, while keeping language clear and consistent.

## Write for the person using the page

Write from the user’s side of the screen. Use the words they recognise, not the words used by the database, API, or internal roadmap. Use specific nouns and active verbs. Prefer “Review 3 visits needing attention” to “View operational exceptions”. Prefer “Add a care worker” to “Provision workforce capacity”.

Use sentence case. Keep one clear idea per sentence. Avoid clever marketing language, filler, unexplained abbreviations, and capitalised system labels. Make link and button text meaningful out of context: use “Open today’s visits” rather than “Click here”, “Read more”, or “Open workflow”. Avoid links that only say “see” or “read”.

## Role language

- Manager: organise care, people, schedules, reviews, and exceptions.
- Carer or care worker: see today’s visits, understand the person’s needs for that visit, record what happened, and raise a concern when needed.
- Family member: understand what happened, what is next, and whether the care team needs their attention.
- Person receiving care: use their name and the established respectful term. Do not default to “client” in customer-facing copy when “person” or “person you support” is clearer and appropriate.

## Words Oasis must avoid

Do not use “care OS”, “assurance room”, “proof-led care”, “capability matrix”, or “operational command centre” in customer-facing UI. Also avoid unexplained “SLA”, “source-linked”, “raw operational records”, “evidence pack”, “care plan governance”, “frontier roadmap”, “staff workflow”, and “system health”. Replace with the user-visible action or outcome: “response deadline”, “records for inspection preparation”, “notes for the care team”, “approved family update”, “care plan review”, or “service status”.

Never use “staff” when addressing frontline workers. Say “carers” or “care workers”. Keep GraphQL, API, auth, IDs, implementation details, and internal route names out of the interface.

## Page structure and headings

Give every page one informative title and one clear `h1`. Headings should describe the content or decision, not provide decoration. Use headings in order without skipping levels. Make the primary action agree with the page heading and keep the same verb across the flow.

## Forms and messages

Every field needs a visible, associated label. Group related choices with a useful legend. Error messages should say what went wrong and how to fix it, sit next to the affected field, and be included in an error summary when a form has multiple errors. Link summary errors to the relevant field so keyboard users can move focus. Preserve data already entered.

State copy should explain what happened, what it means, and what to do next:

- Permission: “You do not have permission to open this record. Ask a manager for access.”
- Empty: “No visits are assigned for today. Check the schedule if you expected one.”
- Load failure: “We could not load today’s visits. Try again.”
- Success: “Visit completed. Add a care note if there is anything the next care worker needs to know.”

Use these as patterns, not fixed copy. Do not imply records were lost when access or loading failed. Do not turn a missing record into reassurance.

## Care safety and trust

Never invent clinical interpretations, care outcomes, compliance status, statistics, family testimonials, named people, or approval status. Keep family content approved and scoped. Explain what is shared without exposing internal workflow language. Use the person’s actual record and the existing data shape; if the product cannot support a claim, make it a product question.

## Content review

Ask:

- Can the intended user understand this without product training?
- Does each heading describe a task, fact, or decision?
- Is the next step obvious?
- Are words consistent across navigation, page title, buttons, notifications, and success messages?
- Could any sentence be read as a clinical, safety, or compliance claim?
- Have long names, dates, times, numbers, and translated or enlarged text been considered?
