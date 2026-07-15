# Oasis pilot readiness gate

This is the canonical readiness verdict for Oasis Care. Pull-request bodies, natural CI and the mission thread carry ordinary progress evidence; this file changes only when a sprint closes, the verdict changes, or material external proof is completed.

## Current verdict

**DO NOT SHIP — 13 July 2026**

Repository foundations have advanced, but neither a real-person pilot nor production is approved. CI green is not clinical, privacy, tenant-isolation, recovery or operational proof. No merge, workflow or document authorizes production access, deployment, live Clerk changes, migrations, backfills, secret rotation or use of real care data.

The exact green foundation-sprint main revision is `c7e425a0a35fe579e408c25909c2a046e947bd68`.

## Foundation sprint closed

| Evidence | Result | Remaining boundary |
| --- | --- | --- |
| [Oasis design skill PR #115](https://github.com/welathfindrr13/oasis-care-international/pull/115) | Merged; repository-specific product, content and accessibility guidance established. | A skill guides review; it is not proof that every surface conforms. |
| [GraphQL operation guards PR #116](https://github.com/welathfindrr13/oasis-care-international/pull/116) | Merged; parser/validation-hook limits and stable rejection behavior covered by hostile tests. | Continue regression coverage as committed operations change. |
| [Secret hygiene PR #117](https://github.com/welathfindrr13/oasis-care-international/pull/117) | Merged; redacted full-history classification completed and new-range prevention added. | Potentially live findings require approval-controlled disposition and rotation; no value was exposed or history rewritten. Repository ruleset enforcement remains external proof. |
| [Truthful controls PR #118](https://github.com/welathfindrr13/oasis-care-international/pull/118) | Merged; unsupported assurance claims, fabricated metrics status, raw errors and inert controls removed. Browser and accessibility evidence is retained. | Hosted Clerk and authenticated metrics remain part of the synthetic tenant/auth gate. |
| Natural main CI | Exact revision above passed CI and introduced-range secret prevention. | Passing CI does not change this verdict. |

## Required gates before any real-person pilot

| Gate | Status | Required proof |
| --- | --- | --- |
| Audit capture | Blocked | Default-deny allowlist merged; clinical, medication, safeguarding, concern and arbitrary free text excluded; bounded error codes only. |
| Accessibility foundation | In progress | Maintained 18-case browser matrix merged with truthful role labels, keyboard, reduced-motion, overflow and Axe evidence. |
| Organization time | In progress | One extensible organization-timezone boundary; UTC instants; strict date-only contract; BST gap/repeat, midnight, eMAR, Manager and Family tests. No organization-timezone schema migration. |
| Visit integrity | Blocked | Atomic completion and audit plus a non-regressing Manager cancellation/correction path. No clinical-policy behavior may be invented. |
| Shift integrity | In progress | Atomic clock-in/out and retry proof, real-Postgres concurrency and audit-rollback evidence, and approval-controlled stable proof-key provisioning. |
| Clerk isolation and capabilities | Blocked | Production/staging fail closed without explicit Clerk configuration; legacy providers restricted to test/development; raw-role UI decisions removed; no live-tenant mutation. |
| Tenant/auth matrix | Blocked | Synthetic Clerk-shaped two-tenant browser and direct-API proof for Manager, assigned/unassigned Carer, Family grant/revocation and cross-organization denial. |
| Medication integrity | Unsafe for pilot | Qualified care-policy decision, stable scheduled-dose occurrence, atomic first outcome, append-only correction, deterministic visit binding and approved Family projection. |
| Privacy and data rights | Blocked | Approved retention, erasure, legal-hold, safeguarding-redaction and SAR operating decisions. Do not claim GDPR compliance. |
| Recovery and operations | Blocked | Revision-bound runtime, synthetic alert delivery/ownership/escalation, approved RPO/RTO, disposable restore evidence and named incident/support ownership. |
| External secrets proof | Blocked | Redacted findings disposition, approval-controlled rotation where required, and verified GitHub ruleset/required-check protection. |
| Performance evidence | Not established | Reproducible representative fixtures first; deterministic query-count, pagination and bounded-operation assertions before any wall-clock budget. |

## Production approval remains separate

Production additionally requires explicit human approval after all pilot gates pass, including live Clerk proof, privacy/care decisions, secret disposition, migration/backfill approval, backup and recovery evidence, alert delivery, training, support and fresh independent reviews. The historical one-time legacy bootstrap documentation is not a production approval.

## Safe local verification

Use the repository-pinned package manager:

```bash
corepack pnpm@9.13.1 deploy:v2:preflight -- deploy/v2/.env
corepack pnpm@9.13.1 deploy:v2:verify
```

Any skipped check because a provider decision, credential, Docker engine or external environment is unavailable remains a blocker, not a pass. Never place credentials or scanner values in readiness evidence.
