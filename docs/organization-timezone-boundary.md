# Organization timezone boundary

Oasis stores and exchanges timestamps as UTC instants. Calendar-day filters,
wall-clock inputs and customer-facing dates must resolve through `@oasis/time`
instead of the host, browser or database timezone.

Database `DATE` columns are not instants. Their inclusive calendar keys are
encoded at UTC midnight only for Prisma transport and are kept separate from
the `[start, end)` UTC instant ranges used to query timestamp columns. This
prevents a London midnight during BST from being persisted as the previous
UTC calendar date.

The UK pilot resolver returns `Europe/London`. That choice exists in one
resolver boundary so a future approved organization-timezone source can replace
it without spreading London-specific constants through services and pages. This
change does not add an organization timezone column or migration.

Local wall-clock conversion has three explicit outcomes: unique, repeated or
missing. Repeated and missing times occur around daylight-saving transitions.
Visit inputs reject both rather than selecting an instant silently.

Calendar-week views retain the existing Sunday-to-Saturday boundary. The AI
batch has a separate, explicitly named completed reporting period covering
Friday through Thursday. Both resolve calendar boundaries through the
organization timezone; neither relies on the host timezone.

Medication schedule materialization also rejects repeated or missing local
times before the prescription is written. Choosing which repeated occurrence
represents a scheduled dose is a clinical policy decision and remains outside
this implementation.
